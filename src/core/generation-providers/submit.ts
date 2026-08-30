import {
  normalizeAssetFirstGenerationRequest,
  type AssetFirstGenerationRequest,
} from '@/core/commands/generation-contract';
import { compileAssetFirstGenerationInput } from '@/core/commands/generation-compiler';
import {
  failGenerationUploadIntent,
  issueGenerationUploadIntent,
} from '@/core/effects/generation-upload-intent';
import { submitEffectGeneration } from '@/core/effects/submit-generation';

import {
  getGenerationModelDescriptor,
  validateGenerationModelInput,
} from './model-catalog';
import {
  getActiveGenerationProvider,
  getGenerationModelBinding,
} from './registry';

export async function submitAssetFirstGeneration({
  generation: source,
  origin,
}: {
  generation: AssetFirstGenerationRequest | unknown;
  origin: 'ui' | 'mcp' | 'cli' | 'system';
}) {
  const generation = normalizeAssetFirstGenerationRequest(source);
  const provider = getActiveGenerationProvider();
  const binding = getGenerationModelBinding({
    modelId: generation.modelId,
    providerId: provider.id,
  });
  if (!binding) {
    throw new Error(
      `Model ${generation.modelId} is not available from ${provider.label}.`
    );
  }
  const descriptor = getGenerationModelDescriptor(generation.modelId);
  if (!descriptor || descriptor.kind !== generation.mode) {
    throw new Error(
      `Model ${generation.modelId} does not support ${generation.mode} generation.`
    );
  }
  await provider.assertConfigured?.();
  const intentId = await issueGenerationUploadIntent({
    projectId: generation.projectId,
    effectId: binding.effectId,
    expectedUploadCount: 0,
  });
  try {
    const input = await compileAssetFirstGenerationInput({
      generation,
      generationIntentId: intentId,
    });
    validateGenerationModelInput({ modelId: generation.modelId, input });
    return await submitEffectGeneration({
      effectId: binding.effectId,
      input,
      projectId: generation.projectId,
      generationIntentId: intentId,
      metadata: {
        origin,
        requestVersion: generation.version,
        logicalModelId: generation.modelId,
      },
    });
  } catch (error) {
    await failGenerationUploadIntent({ intentId });
    throw error;
  }
}
