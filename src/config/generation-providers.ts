import type { GenerationProviderRegistrar } from '@/core/generation-providers/contracts';

/**
 * Source-level extension point for open-source forks.
 *
 * BeatAPI is registered by the core and remains the default. A fork can add a
 * provider implementation here and change ACTIVE_GENERATION_PROVIDER_ID.
 * Keep credentials inside that provider's server-only implementation.
 */
export const ACTIVE_GENERATION_PROVIDER_ID = 'beatapi';

export function registerProjectGenerationProviders(
  _register: GenerationProviderRegistrar
) {}
