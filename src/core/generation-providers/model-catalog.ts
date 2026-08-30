import {
  getWorkspaceEffectRegistryEntry,
  type WorkspaceEffectRegistryEntry,
} from '@/core/effects/effect-registry';
import { getRegisteredEffectById } from '@/core/effects/registered-effects';
import { getWorkspaceMediaSchema } from '@/core/effects/workspace-media';
import {
  VIDEO_ANALYSIS_MODEL_ID,
} from '@/core/effects/video-analysis';

import {
  getActiveGenerationProvider,
  getGenerationModelBinding,
} from './registry';

const defaultsFromEntry = (entry: WorkspaceEffectRegistryEntry) => ({
  ...(entry.defaultAspectRatio
    ? { aspect_ratio: entry.defaultAspectRatio }
    : {}),
  ...(entry.defaultDuration ? { wmDuration: entry.defaultDuration } : {}),
  ...(entry.defaultOutputQuality
    ? { wmOutputQuality: entry.defaultOutputQuality }
    : {}),
  ...(entry.defaultQuality ? { quality: entry.defaultQuality } : {}),
  ...(entry.defaultMode ? { mode: entry.defaultMode } : {}),
  ...(entry.defaultLanguage ? { language: entry.defaultLanguage } : {}),
  ...(entry.defaultCharacterOrientation
    ? { characterOrientation: entry.defaultCharacterOrientation }
    : {}),
  ...(entry.defaultBackgroundSource
    ? { backgroundSource: entry.defaultBackgroundSource }
    : {}),
});

export type GenerationModelDescriptor = {
  id: string;
  name: string;
  providerId: string;
  kind: 'image' | 'video' | 'analysis';
  available: boolean;
  parameterSchema: unknown;
  defaultParameters: Record<string, unknown>;
  referenceSchema: unknown;
};

export function listGenerationModelDescriptors(): GenerationModelDescriptor[] {
  const provider = getActiveGenerationProvider();
  return provider.modelBindings.flatMap<GenerationModelDescriptor>((binding) => {
    const effect = getRegisteredEffectById(binding.effectId);
    if (!effect) return [];
    if (binding.modelId === VIDEO_ANALYSIS_MODEL_ID) {
      return [
        {
          id: VIDEO_ANALYSIS_MODEL_ID,
          name: 'Video Analysis',
          providerId: provider.id,
          kind: 'analysis' as const,
          available: true,
          parameterSchema: effect.inputSchema,
          defaultParameters: {
            analysis_depth: 'standard',
            max_output_tokens: 2048,
          },
          referenceSchema: {
            image: { min: 0, max: 0 },
            video: { min: 1, max: 1 },
            audio: { min: 0, max: 0 },
          },
        },
      ];
    }
    const entry = getWorkspaceEffectRegistryEntry(binding.modelId);
    if (!entry) return [];
    return [
      {
        id: entry.id,
        name: entry.name,
        providerId: provider.id,
        kind: entry.workspaceType === 'ai-image' ? ('image' as const) : ('video' as const),
        available: true,
        parameterSchema: effect.inputSchema,
        defaultParameters: defaultsFromEntry(entry),
        referenceSchema: getWorkspaceMediaSchema(entry.id),
      },
    ];
  });
}

export function getGenerationModelDescriptor(modelId: string) {
  return (
    listGenerationModelDescriptors().find((model) => model.id === modelId) ??
    null
  );
}

export function validateGenerationModelInput({
  modelId,
  input,
}: {
  modelId: string;
  input: Record<string, unknown>;
}) {
  const provider = getActiveGenerationProvider();
  const binding = getGenerationModelBinding({ modelId, providerId: provider.id });
  if (!binding) throw new Error(`Model ${modelId} is not available from ${provider.label}.`);
  const effect = getRegisteredEffectById(binding.effectId);
  if (!effect) throw new Error(`Model ${modelId} is not registered.`);
  provider.validateInput?.(effect, input);
  return { provider, binding, effect };
}
