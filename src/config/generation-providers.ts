import type { GenerationProviderRegistrar } from '@/core/generation-providers/contracts';
import { newApi16688GenerationProvider } from '@/core/generation-providers/newapi-16688-provider';

/**
 * Source-level extension point for open-source forks.
 *
 * BeatAPI is registered by the core and remains the default. A fork can add a
 * provider implementation here and change ACTIVE_GENERATION_PROVIDER_ID.
 * Keep credentials inside that provider's server-only implementation.
 */
const requestedProviderId = import.meta.env?.VITE_GENERATION_PROVIDER_ID?.trim();
const is16688BuildMode = import.meta.env?.MODE === '16688';

export const ACTIVE_GENERATION_PROVIDER_ID =
  requestedProviderId === '16688' || is16688BuildMode ? '16688' : 'beatapi';

export function registerProjectGenerationProviders(
  register: GenerationProviderRegistrar
) {
  register(newApi16688GenerationProvider);
}
