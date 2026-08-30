import type { GenerationProviderRegistrar } from '@/core/generation-providers/contracts';

/**
 * Source-level extension point for open-source forks.
 *
 * BeatAPI is registered by the core and remains the default. A fork can add a
 * provider implementation here, then set GENERATION_PROVIDER to its id. Keep
 * credentials inside that provider's server-only implementation.
 */
export function registerProjectGenerationProviders(
  _register: GenerationProviderRegistrar
) {}
