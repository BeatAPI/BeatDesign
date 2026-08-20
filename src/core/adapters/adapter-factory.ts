import { BeatApiAdapter } from './beatapi-adapter';
import { MockAdapter } from './mock-adapter';
import type { EffectRecord } from './base-adapter';

export const createAdapter = (effect: EffectRecord) => {
  switch (effect.provider) {
    case 'beatapi':
      return new BeatApiAdapter(effect);
    case 'mock':
      return new MockAdapter(effect);
    default:
      throw new Error(`Unsupported generation provider: ${effect.provider}`);
  }
};
