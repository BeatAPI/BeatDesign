import {
  NewApi16688Adapter,
  validate16688ImageInput,
} from '@/core/adapters/newapi-16688-adapter';
import { getConfig } from '@/modules/config/service';

import type { GenerationProviderDefinition } from './contracts';

export const NEWAPI_16688_PROVIDER_ID = '16688';

export const NEWAPI_16688_MODEL_BINDINGS = [
  ['nano-banana-2', 25, 'gemini-3.1-flash-image'],
  ['nano-banana-pro', 6, 'gemini-3.0-pro-image'],
  ['gpt-image-2', 12, 'gpt-image-2'],
  ['gpt-image-2.5-flare', 27, 'gpt-image-2.5-flare'],
  ['gpt-image-2.5-sunburst', 28, 'gpt-image-2.5-sunburst'],
] as const;

export const newApi16688GenerationProvider: GenerationProviderDefinition = {
  id: NEWAPI_16688_PROVIDER_ID,
  label: '16688 AI',
  supports: ['image'],
  modelBindings: NEWAPI_16688_MODEL_BINDINGS.map(([modelId, effectId, upstreamModelId]) => ({
    modelId,
    effectId,
    upstreamModelId,
    uploadPath: '',
    imageBucketName: 'local',
  })),
  createAdapter: (effect) => new NewApi16688Adapter(effect),
  assertConfigured: async (binding) => {
    const isGemini = binding?.upstreamModelId.startsWith('gemini-') === true;
    const configKey = isGemini ? 'MEDIA_GATEWAY_API_KEY' : 'NEWAPI_API_KEY';
    if (!(await getConfig(configKey))) {
      throw new Error(
        isGemini
          ? 'Connect the Gemini media gateway before generating.'
          : 'Connect a 16688 AI API key before generating.'
      );
    }
  },
  validateInput: (effect, input) => {
    validate16688ImageInput({ effectType: effect.type, input });
  },
};
