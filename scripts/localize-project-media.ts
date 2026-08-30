import { isOfficialBeatApiMediaUrl } from '@/core/effects/beatapi-media-url';
import {
  createLocalProviderAssetId,
  LOCAL_MEDIA_DOWNLOAD_TIMEOUT_MS,
  MAX_LOCAL_IMAGE_ASSET_BYTES,
  MAX_LOCAL_VIDEO_ASSET_BYTES,
} from '@/core/effects/output-storage';
import {
  LOCAL_PROJECT_ASSET_BUCKET,
  LOCAL_PROJECT_ASSET_PROVIDER,
  persistLocalProjectAsset,
} from '@/core/projects/local-project-assets';
import {
  loadProjectWithLatestSnapshot,
  loadProjects,
  saveProjectSnapshot,
} from '@/core/projects/projects';
import {
  linkProjectAsset,
  recordUserAsset,
} from '@/core/workspace-lib/assets/user-assets';
import { readResponseBodyWithLimit } from '@/lib/response-body-limit';

const filenameFromUrl = (url: string, type: 'image' | 'video') => {
  try {
    const filename = decodeURIComponent(
      new URL(url).pathname.split('/').pop() || ''
    );
    if (filename) return filename;
  } catch {
    // Fall through to a stable filename.
  }
  return type === 'video' ? 'migrated-video.mp4' : 'migrated-image.png';
};

const localizeProject = async (projectId: string) => {
  const state = await loadProjectWithLatestSnapshot({ projectId });
  if (!state) return { cards: 0, files: 0 };

  const cardsWithRemoteMedia = state.snapshot.cards.filter(
    (card): card is typeof card & { type: 'image' | 'video'; url: string } =>
      (card.type === 'image' || card.type === 'video') &&
      Boolean(card.url && isOfficialBeatApiMediaUrl(card.url))
  );
  if (cardsWithRemoteMedia.length === 0) return { cards: 0, files: 0 };

  const localizedByProviderUrl = new Map<
    string,
    { assetId: string; publicUrl: string }
  >();

  for (const card of cardsWithRemoteMedia) {
    const providerUrl = card.url as string;
    if (localizedByProviderUrl.has(providerUrl)) continue;

    const response = await fetch(providerUrl, {
      signal: AbortSignal.timeout(LOCAL_MEDIA_DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status}): ${providerUrl}`);
    }
    const maxBytes =
      card.type === 'video'
        ? MAX_LOCAL_VIDEO_ASSET_BYTES
        : MAX_LOCAL_IMAGE_ASSET_BYTES;
    const bytes = await readResponseBodyWithLimit(response, maxBytes);
    const responseMimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    const mimeType = responseMimeType.startsWith(`${card.type}/`)
      ? responseMimeType
      : card.type === 'video'
        ? 'video/mp4'
        : 'image/png';
    const persisted = await persistLocalProjectAsset({
      projectId,
      assetId: createLocalProviderAssetId(projectId, providerUrl),
      filename: filenameFromUrl(providerUrl, card.type),
      mimeType,
      bytes,
    });
    const assetId = await recordUserAsset({
      id: persisted.assetId,
      type: card.type,
      source: 'provider',
      storageProvider: LOCAL_PROJECT_ASSET_PROVIDER,
      bucket: LOCAL_PROJECT_ASSET_BUCKET,
      objectKey: persisted.objectKey,
      publicUrl: persisted.publicUrl,
      filename: persisted.filename,
      mimeType,
      sizeBytes: persisted.sizeBytes,
      sha256: persisted.sha256,
      originProjectId: projectId,
      metadata: { migratedFromProviderUrl: providerUrl },
    });
    await linkProjectAsset({
      projectId,
      assetId,
      role: card.kind === 'output' ? 'generated' : 'reference',
      metadata: { migratedFromProviderUrl: providerUrl },
    });
    localizedByProviderUrl.set(providerUrl, {
      assetId,
      publicUrl: persisted.publicUrl,
    });
    console.log(`localized ${card.type}: ${persisted.filename}`);
  }

  const nextCards = state.snapshot.cards.map((card) => {
    const localized = card.url
      ? localizedByProviderUrl.get(card.url)
      : undefined;
    return localized
      ? { ...card, url: localized.publicUrl, assetId: localized.assetId }
      : card;
  });
  await saveProjectSnapshot({
    projectId,
    document: { ...state.snapshot, cards: nextCards },
    baseVersion: state.snapshotVersion,
  });

  return {
    cards: cardsWithRemoteMedia.length,
    files: localizedByProviderUrl.size,
  };
};

const projects = await loadProjects({ limit: 1_000 });
let localizedCards = 0;
let localizedFiles = 0;
for (const currentProject of projects) {
  const result = await localizeProject(currentProject.id);
  localizedCards += result.cards;
  localizedFiles += result.files;
}

console.log(
  `done: ${localizedFiles} local files now back ${localizedCards} canvas cards`
);
