import { getGenerationProvider } from '@/core/generation-providers';
import type { EffectRecord } from './base-adapter';

export const createAdapter = (effect: EffectRecord) => {
  const provider = getGenerationProvider(effect.provider);
  if (!provider) {
    throw new Error(`Unsupported generation provider: ${effect.provider}`);
  }
  return provider.createAdapter(effect);
};
