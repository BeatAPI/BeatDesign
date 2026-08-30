import { envConfigs } from '@/config';
import { registerProjectGenerationProviders } from '@/config/generation-providers';
import { MockAdapter } from '@/core/adapters/mock-adapter';

import { beatApiGenerationProvider, BEATAPI_PROVIDER_ID } from './beatapi-provider';
import type {
  GenerationProviderDefinition,
  GenerationProviderModelBinding,
} from './contracts';

const providers = new Map<string, GenerationProviderDefinition>();
let initialized = false;

function addProvider(provider: GenerationProviderDefinition) {
  const id = provider.id.trim();
  if (!id) throw new Error('Generation provider id is required.');
  if (providers.has(id)) {
    throw new Error(`Generation provider ${id} is already registered.`);
  }
  const modelIds = new Set<string>();
  const effectIds = new Set<number>();
  for (const binding of provider.modelBindings) {
    if (modelIds.has(binding.modelId)) {
      throw new Error(`Provider ${id} has duplicate model ${binding.modelId}.`);
    }
    if (effectIds.has(binding.effectId)) {
      throw new Error(`Provider ${id} has duplicate effect id ${binding.effectId}.`);
    }
    modelIds.add(binding.modelId);
    effectIds.add(binding.effectId);
  }
  providers.set(id, { ...provider, id });
}

function ensureProvidersRegistered() {
  if (initialized) return;
  initialized = true;
  addProvider(beatApiGenerationProvider);
  addProvider({
    id: 'mock',
    label: 'Mock',
    supports: ['image', 'video'],
    modelBindings: [],
    createAdapter: (effect) => new MockAdapter(effect),
  });
  registerProjectGenerationProviders(addProvider);
}

export const registerGenerationProvider = addProvider;

export function listGenerationProviders() {
  ensureProvidersRegistered();
  return [...providers.values()];
}

export function getGenerationProvider(providerId: string) {
  ensureProvidersRegistered();
  return providers.get(providerId) ?? null;
}

export function getActiveGenerationProviderId() {
  ensureProvidersRegistered();
  const requested = envConfigs.generation_provider?.trim() || BEATAPI_PROVIDER_ID;
  if (!providers.has(requested)) {
    throw new Error(
      `Generation provider ${requested} is not registered. Register it in src/config/generation-providers.ts or set GENERATION_PROVIDER=${BEATAPI_PROVIDER_ID}.`
    );
  }
  return requested;
}

export function getActiveGenerationProvider() {
  const providerId = getActiveGenerationProviderId();
  const provider = getGenerationProvider(providerId);
  if (!provider) throw new Error(`Generation provider ${providerId} is not registered.`);
  return provider;
}

export function getGenerationModelBinding({
  modelId,
  providerId = getActiveGenerationProviderId(),
}: {
  modelId: string;
  providerId?: string;
}): GenerationProviderModelBinding | null {
  const provider = getGenerationProvider(providerId);
  return provider?.modelBindings.find((binding) => binding.modelId === modelId) ?? null;
}

export function getGenerationModelBindingByEffectId({
  effectId,
  providerId = getActiveGenerationProviderId(),
}: {
  effectId: number;
  providerId?: string;
}): GenerationProviderModelBinding | null {
  const provider = getGenerationProvider(providerId);
  return provider?.modelBindings.find((binding) => binding.effectId === effectId) ?? null;
}

export function resolveProviderUpstreamModel({
  modelId,
  variant,
  providerId,
}: {
  modelId: string;
  variant?: string | null;
  providerId?: string;
}) {
  const binding = getGenerationModelBinding({ modelId, providerId });
  if (!binding) return modelId;
  return (variant && binding.upstreamModelByVariant?.[variant]) || binding.upstreamModelId;
}
