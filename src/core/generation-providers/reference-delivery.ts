import { isPublicHttpMediaUrl } from '@/core/effects/beatapi-media-url';

export type GenerationReferenceAssetDelivery = {
  publicUrl: string;
  source: string;
  metadata: unknown;
};

export const getProviderGenerationAssetUrl = (
  asset: GenerationReferenceAssetDelivery
) => {
  if (
    asset.source !== 'provider' ||
    !asset.metadata ||
    typeof asset.metadata !== 'object'
  ) {
    return null;
  }
  const providerUrl = (asset.metadata as Record<string, unknown>).providerUrl;
  return typeof providerUrl === 'string' && isPublicHttpMediaUrl(providerUrl)
    ? providerUrl
    : null;
};

export const needsManagedGenerationReferenceUpload = (
  asset: GenerationReferenceAssetDelivery
) =>
  !isPublicHttpMediaUrl(asset.publicUrl) &&
  !getProviderGenerationAssetUrl(asset);
