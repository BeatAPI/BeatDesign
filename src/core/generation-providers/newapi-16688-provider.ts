import {
  NewApi16688Adapter,
  validate16688ImageInput,
} from '@/core/adapters/newapi-16688-adapter';
import { getConfig } from '@/modules/config/service';

import type { GenerationProviderDefinition } from './contracts';

export const NEWAPI_16688_PROVIDER_ID = '16688';

export const NEWAPI_16688_MODEL_BINDINGS = [
  ['gpt-image-2', 12],
  ['gpt-image-2.5-flare', 27],
  ['gpt-image-2.5-sunburst', 28],
] as const;

export const newApi16688GenerationProvider: GenerationProviderDefinition = {
  id: NEWAPI_16688_PROVIDER_ID,
  label: '16688 AI',
  supports: ['image'],
  modelBindings: NEWAPI_16688_MODEL_BINDINGS.map(([modelId, effectId]) => ({
    modelId,
    effectId,
    upstreamModelId: modelId,
    uploadPath: '',
    imageBucketName: 'local',
  })),
  createAdapter: (effect) => new NewApi16688Adapter(effect),
  assertConfigured: async () => {
    if (!(await getConfig('NEWAPI_API_KEY'))) {
      throw new Error('Connect a 16688 AI API key before generating.');
    }
  },
  validateInput: (effect, input) => {
    validate16688ImageInput({ effectType: effect.type, input });
  },
};
