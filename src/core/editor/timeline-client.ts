import type { RecentAsset } from '@/core/workspace-lib/app/workspace-client-api';
import { createCommandId } from '@/core/commands/contracts';
import { executeProjectCommand } from '@/core/commands/client';
import type { EditorOperation } from '@/core/commands/editor-commands';
import type { TimelineDocument } from '@/core/editor/timeline-document';
import { apiJsonGet } from '@/lib/api-client';

type TimelineStatePayload = {
  timeline: { document: TimelineDocument; version: number } | null;
};

export const loadBrowserMediaDuration = (
  url: string,
  mediaType: 'video' | 'audio'
) =>
  new Promise<number>((resolve, reject) => {
    const element = document.createElement(mediaType);
    const cleanup = () => {
      element.removeAttribute('src');
      element.load();
    };
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = element.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error('Media duration is unavailable'));
    };
    element.onerror = () => {
      cleanup();
      reject(new Error('Media metadata could not be loaded'));
    };
    element.src = url;
  });

export const DEFAULT_IMAGE_CLIP_DURATION = 3;

export async function addProjectAssetToTimeline({
  projectId,
  projectName,
  asset,
  mediaType,
}: {
  projectId: string;
  projectName?: string;
  asset: RecentAsset;
  mediaType: 'image' | 'video' | 'audio';
}) {
  return addProjectAssetsToTimeline({
    projectId,
    projectName,
    assets: [{ asset, mediaType }],
  });
}

export async function addProjectAssetsToTimeline({
  projectId,
  projectName: _projectName,
  assets,
}: {
  projectId: string;
  projectName?: string;
  assets: Array<{
    asset: RecentAsset;
    mediaType: 'image' | 'video' | 'audio';
  }>;
}) {
  if (assets.length === 0) throw new Error('Select at least one timeline asset');
  if (assets.some(({ asset }) => !asset.id?.trim())) {
    throw new Error('Timeline clips must reference a project asset');
  }
  const uniqueAssets = Array.from(
    new Map(assets.map((entry) => [entry.asset.id, entry])).values()
  );
  const prepared = await Promise.all(
    uniqueAssets.map(async ({ asset, mediaType }) => ({
      asset,
      mediaType,
      sourceDuration:
        mediaType === 'image'
          ? DEFAULT_IMAGE_CLIP_DURATION
          : typeof asset.durationMs === 'number' && asset.durationMs > 0
            ? asset.durationMs / 1000
            : await loadBrowserMediaDuration(asset.publicUrl, mediaType),
    }))
  );
  const batchId = createCommandId();
  const operations: EditorOperation[] = prepared.map(
    ({ asset, mediaType, sourceDuration }, index) => ({
      type: 'add_clip' as const,
      clipId: `clip:${batchId}:${asset.id}:${index}`,
      assetId: asset.id,
      sourceUrl: '',
      name:
        asset.filename?.trim() ||
        (mediaType === 'audio'
          ? 'Audio'
          : mediaType === 'image'
            ? 'Image'
            : 'Video'),
      sourceType: mediaType,
      sourceDuration,
      ...(mediaType === 'audio'
        ? { startTime: 0, audioRole: 'music' as const }
        : {}),
    })
  );

  const endpoint = `/api/app/projects/${encodeURIComponent(projectId)}/timeline`;
  const initial = await apiJsonGet<TimelineStatePayload>(endpoint);
  const execute = (expectedRevision: number | null) =>
    executeProjectCommand({
      projectId,
      commandId: batchId,
      idempotencyKey: batchId,
      expectedRevision,
      command: { type: 'editor.apply', operations },
    });
  let result = await execute(initial.timeline?.version ?? null);
  if (!result.ok && result.code === 'REVISION_CONFLICT') {
    const latest = await apiJsonGet<TimelineStatePayload>(endpoint);
    result = await execute(latest.timeline?.version ?? null);
  }
  if (!result.ok || !result.data.timeline || typeof result.revision !== 'number') {
    throw new Error(result.ok ? 'Timeline command returned no document' : result.message);
  }
  return {
    timeline: {
      document: result.data.timeline,
      version: result.revision,
    },
  };
}
