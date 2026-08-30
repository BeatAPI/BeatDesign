import {
  BeatApiAdapter,
  validateBeatApiTaskInput,
} from '@/core/adapters/beatapi-adapter';
import { getConfig } from '@/modules/config/service';

import type { GenerationProviderDefinition } from './contracts';

export const BEATAPI_PROVIDER_ID = 'beatapi';

export const BEATAPI_MODEL_BINDINGS = [
  ['nano-banana-pro', 6, 'effects/nano-banana-pro', 'image'],
  ['nano-banana', 5, 'effects/nano-banana', 'image'],
  ['gpt-image-2', 12, 'effects/gpt-image-2', 'image'],
  ['seedream-5-pro', 16, 'effects/seedream-5-pro', 'image'],
  ['grok-imagine-image-2.0', 23, 'effects/grok-imagine-image-2-0', 'image'],
  ['seedance-2', 9, 'effects/seedance-2', 'image'],
  ['seedance-2-fast', 21, 'effects/seedance-2-fast', 'image'],
  ['seedance-2-mini', 22, 'effects/seedance-2-mini', 'image'],
  ['seedance-2.5', 18, 'effects/seedance-2-5', 'image'],
  ['minimax-h3', 17, 'effects/minimax-h3', 'image'],
  ['veo-3.1', 1, 'effects/veo-3-1', 'image'],
  ['kling-3', 10, 'effects/kling-3', 'image'],
  ['grok-imagine-video-1.5', 24, 'effects/grok-imagine-video-1-5', 'image'],
  ['kling-2.6-motion-control', 19, 'effects/kling-2-6-motion-control', 'image'],
  ['kling-3-motion-control', 20, 'effects/kling-3-motion-control', 'image'],
  ['video-analysis', 1001, 'effects/video-analysis', 'video'],
] as const;

export const beatApiGenerationProvider: GenerationProviderDefinition = {
  id: BEATAPI_PROVIDER_ID,
  label: 'BeatAPI',
  supports: ['image', 'video', 'analysis'],
  modelBindings: BEATAPI_MODEL_BINDINGS.map(
    ([modelId, effectId, uploadPath, imageBucketName]) => ({
      modelId,
      effectId,
      upstreamModelId: modelId,
      uploadPath,
      imageBucketName,
    })
  ),
  createAdapter: (effect) => new BeatApiAdapter(effect),
  assertConfigured: async () => {
    if (!(await getConfig('BEATAPI_API_KEY'))) {
      throw new Error('Connect a BeatAPI API key before generating.');
    }
  },
  validateInput: (effect, input) => {
    validateBeatApiTaskInput({
      effectType: effect.type,
      model: effect.model,
      input,
    });
  },
};
