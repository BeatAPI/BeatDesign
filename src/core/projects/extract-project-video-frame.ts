import { basename } from 'node:path';

import { extractVideoFrameFromFile } from '@/core/media/extract-video-frame-file';
import {
  LOCAL_PROJECT_ASSET_BUCKET,
  LOCAL_PROJECT_ASSET_PROVIDER,
  persistLocalProjectAsset,
  removePersistedLocalProjectAsset,
  resolveLocalProjectAssetPath,
} from '@/core/projects/local-project-assets';
import { getProject } from '@/core/projects/projects';
import {
  deleteUserAssetById,
  getProjectAssetById,
  linkProjectAsset,
  recordUserAsset,
} from '@/core/workspace-lib/assets/user-assets';

const sanitizeName = (value: string) =>
  basename(value.trim() || 'video')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .slice(0, 80) || 'video';

type FrameAssetMetadata = {
  operation?: unknown;
  parentAssetId?: unknown;
  sourceTimeSec?: unknown;
  sourceDurationSec?: unknown;
  position?: unknown;
  purpose?: unknown;
};

const frameLabel = (position: 'first' | 'last' | number) =>
  position === 'first'
    ? 'first-frame'
    : position === 'last'
      ? 'tail-frame'
      : `frame-${Math.max(0, position).toFixed(3).replace('.', '-')}`;

export async function extractProjectVideoFrame({
  projectId,
  assetId,
  position = 'last',
  derivedAssetId,
  purpose = 'frame_extract',
}: {
  projectId: string;
  assetId: string;
  position?: 'first' | 'last' | number;
  derivedAssetId?: string;
  purpose?: 'frame_extract' | 'continuation_first_frame';
}) {
  const project = await getProject({ projectId });
  if (!project || project.status !== 'active') {
    throw new Error('Project not found.');
  }
  const source = await getProjectAssetById({ projectId, assetId });
  if (!source) throw new Error('Asset not found in this project.');
  if (source.type !== 'video') {
    throw new Error('Frame extraction requires a video asset.');
  }
  if (source.bucket !== LOCAL_PROJECT_ASSET_BUCKET || !source.objectKey) {
    throw new Error('Frame extraction requires a local project video file.');
  }

  if (derivedAssetId) {
    const existing = await getProjectAssetById({
      projectId,
      assetId: derivedAssetId,
    });
    if (existing) {
      const metadata = (existing.metadata ?? {}) as FrameAssetMetadata;
      if (
        existing.type !== 'image' ||
        existing.bucket !== LOCAL_PROJECT_ASSET_BUCKET ||
        metadata.operation !== 'video_frame_extract' ||
        metadata.parentAssetId !== source.id ||
        metadata.purpose !== purpose ||
        metadata.position !== position ||
        typeof existing.width !== 'number' ||
        typeof existing.height !== 'number' ||
        typeof metadata.sourceTimeSec !== 'number' ||
        typeof metadata.sourceDurationSec !== 'number'
      ) {
        throw new Error('Derived frame asset id is already in use.');
      }
      return {
        id: existing.id,
        type: 'image' as const,
        publicUrl: existing.publicUrl,
        filename: existing.filename ?? `${sanitizeName(source.filename || 'video')}-${frameLabel(position)}.png`,
        mimeType: 'image/png' as const,
        width: existing.width,
        height: existing.height,
        timeSeconds: metadata.sourceTimeSec,
        durationSeconds: metadata.sourceDurationSec,
        parentAssetId: source.id,
        reused: true,
      };
    }
  }

  const filePath = resolveLocalProjectAssetPath({ objectKey: source.objectKey });
  const frame = await extractVideoFrameFromFile({ filePath, position });
  const filename = `${sanitizeName(source.filename || 'video')}-${frameLabel(position)}.png`;
  const persisted = await persistLocalProjectAsset({
    projectId,
    assetId: derivedAssetId,
    filename,
    mimeType: 'image/png',
    bytes: frame.bytes,
  });

  try {
    const id = await recordUserAsset({
      id: persisted.assetId,
      type: 'image',
      source: 'derived',
      bucket: LOCAL_PROJECT_ASSET_BUCKET,
      objectKey: persisted.objectKey,
      publicUrl: persisted.publicUrl,
      mimeType: 'image/png',
      sizeBytes: persisted.sizeBytes,
      sha256: persisted.sha256,
      filename: persisted.filename,
      storageProvider: LOCAL_PROJECT_ASSET_PROVIDER,
      assetClass: 'derived',
      originProjectId: projectId,
      width: frame.width,
      height: frame.height,
      metadata: {
        operation: 'video_frame_extract',
        parentAssetId: source.id,
        sourceTimeSec: frame.timeSeconds,
        sourceDurationSec: frame.durationSeconds,
        purpose,
        position,
      },
    });
    await linkProjectAsset({
      projectId,
      assetId: id,
      role: 'reference',
      assetRole: 'video_frame',
      metadata: {
        operation: 'video_frame_extract',
        parentAssetId: source.id,
        purpose,
      },
    });
    return {
      id,
      type: 'image' as const,
      publicUrl: persisted.publicUrl,
      filename: persisted.filename,
      mimeType: 'image/png',
      width: frame.width,
      height: frame.height,
      timeSeconds: frame.timeSeconds,
      durationSeconds: frame.durationSeconds,
      parentAssetId: source.id,
      reused: false,
    };
  } catch (error) {
    await deleteUserAssetById(persisted.assetId).catch(() => undefined);
    await removePersistedLocalProjectAsset(persisted.filePath);
    throw error;
  }
}

export async function removeExtractedProjectVideoFrame({
  projectId,
  assetId,
}: {
  projectId: string;
  assetId: string;
}) {
  const asset = await getProjectAssetById({ projectId, assetId });
  if (!asset) return false;
  const metadata = (asset.metadata ?? {}) as FrameAssetMetadata;
  if (
    asset.source !== 'derived' ||
    asset.bucket !== LOCAL_PROJECT_ASSET_BUCKET ||
    !asset.objectKey ||
    metadata.operation !== 'video_frame_extract'
  ) {
    throw new Error('Only extracted local video frames can be removed here.');
  }
  const filePath = resolveLocalProjectAssetPath({ objectKey: asset.objectKey });
  await deleteUserAssetById(asset.id);
  await removePersistedLocalProjectAsset(filePath);
  return true;
}
