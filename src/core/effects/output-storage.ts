import { createHash } from 'crypto';

import { resolveOutputMedia } from './output-media';
import {
  linkGenerationAsset,
  recordUserAsset,
  type AssetType,
} from '@/core/workspace-lib/assets/user-assets';

export const OUTPUT_STORAGE_SYNC_RETRY_ERROR = '';
export const didOutputStorageSyncFail = (_output?: unknown) => false;
export const shouldRetryOutputStorageSync = (_input?: unknown) => false;

const objectKeyForUrl = (url: string) =>
  `provider/${createHash('sha256').update(url).digest('hex')}`;

export async function persistEffectOutputIfNeeded({
  output,
  wmTaskId,
  effectId,
  effectType,
}: {
  output: unknown;
  wmTaskId: string;
  effectId: number;
  effectType: number;
}) {
  if (effectType === 3) return output;
  const media = resolveOutputMedia(output);
  const urls = Array.from(
    new Set(
      effectType === 1
        ? [...media.videoUrls, media.resultUrl]
        : [...media.imageUrls, ...media.resultUrls, media.resultUrl]
    )
  ).filter((url): url is string => Boolean(url));
  const type: AssetType = effectType === 1 ? 'video' : 'image';
  const assetIds: string[] = [];

  for (const url of urls) {
    const assetId = await recordUserAsset({
      type,
      source: 'provider',
      storageProvider: 'beatapi',
      bucket: 'beatapi',
      objectKey: objectKeyForUrl(url),
      publicUrl: url,
      metadata: { effectId, generationId: wmTaskId },
    });
    await linkGenerationAsset({ generationId: wmTaskId, assetId, role: 'output' });
    assetIds.push(assetId);
  }

  if (!output || typeof output !== 'object' || assetIds.length === 0) {
    return output;
  }
  return {
    ...(output as Record<string, unknown>),
    assetIds,
    storage_sync_failed: false,
  };
}
