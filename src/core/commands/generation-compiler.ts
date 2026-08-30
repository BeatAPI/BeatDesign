import { getCompletedIntentUploads } from '@/core/effects/generation-upload-intent';
import { getProjectAssetById } from '@/core/workspace-lib/assets/user-assets';

import type { AssetFirstGenerationRequest } from './generation-contract';

const MEDIA_PARAMETER_KEYS = new Set([
  'prompt',
  'placement',
  'image_url',
  'image_urls',
  'video_url',
  'video_urls',
  'audio_url',
  'audio_urls',
  'first_frame',
  'last_frame',
  'callBackUrl',
  'callbackUrl',
]);

export class GenerationReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationReferenceError';
  }
}

export async function compileAssetFirstGenerationInput({
  generation,
  generationIntentId,
}: {
  generation: AssetFirstGenerationRequest;
  generationIntentId: string;
}) {
  const uploads = (await getCompletedIntentUploads({
    intentId: generationIntentId,
  })) as Array<{ publicUrl: string | null }>;
  const uploadedUrls = new Set(
    uploads
      .map((upload: { publicUrl: string | null }) => upload.publicUrl?.trim())
      .filter((url: string | undefined): url is string => Boolean(url))
  );
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];
  const audioUrls: string[] = [];
  let firstFrame: string | null = null;
  let lastFrame: string | null = null;

  for (const reference of generation.references) {
    const asset = await getProjectAssetById({
      projectId: generation.projectId,
      assetId: reference.assetId,
    });
    if (!asset) {
      throw new GenerationReferenceError(
        `Asset ${reference.assetId} does not belong to this project.`
      );
    }
    const deliveryUrl = reference.deliveryUrl?.trim() || asset.publicUrl.trim();
    if (
      deliveryUrl !== asset.publicUrl.trim() &&
      !uploadedUrls.has(deliveryUrl)
    ) {
      throw new GenerationReferenceError(
        `Delivery URL for asset ${reference.assetId} is not authorized by this generation intent.`
      );
    }

    if (reference.role === 'audio_track' || asset.type === 'audio') {
      audioUrls.push(deliveryUrl);
      continue;
    }
    if (asset.type === 'video') {
      videoUrls.push(deliveryUrl);
      continue;
    }
    if (asset.type !== 'image') {
      throw new GenerationReferenceError(
        `Asset ${reference.assetId} has an unsupported media type.`
      );
    }
    imageUrls.push(deliveryUrl);
    if (reference.role === 'first_frame') firstFrame = deliveryUrl;
    if (reference.role === 'last_frame') lastFrame = deliveryUrl;
  }

  const parameters = Object.fromEntries(
    Object.entries(generation.parameters).filter(
      ([key]) => !MEDIA_PARAMETER_KEYS.has(key)
    )
  );
  return {
    ...parameters,
    prompt: generation.prompt,
    ...(imageUrls.length > 0 ? { image_urls: [...new Set(imageUrls)] } : {}),
    ...(videoUrls.length > 0 ? { video_urls: [...new Set(videoUrls)] } : {}),
    ...(audioUrls.length > 0 ? { audio_urls: [...new Set(audioUrls)] } : {}),
    ...(firstFrame ? { first_frame: firstFrame } : {}),
    ...(lastFrame ? { last_frame: lastFrame } : {}),
    ...(generation.mode === 'analysis' && videoUrls[0]
      ? { video_url: videoUrls[0] }
      : {}),
  };
}
