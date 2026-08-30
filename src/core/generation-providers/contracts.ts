import type { BaseAdapter, EffectRecord } from '@/core/adapters/base-adapter';

export type GenerationMediaCapability = 'image' | 'video' | 'audio' | 'analysis';

export type GenerationProviderModelBinding = {
  /** Stable BeatDesign product model id. */
  modelId: string;
  /** Provider-local numeric id retained for existing DB/API compatibility. */
  effectId: number;
  /** Provider model name sent upstream. */
  upstreamModelId: string;
  uploadPath: string;
  imageBucketName: string;
  upstreamModelByVariant?: Readonly<Record<string, string>>;
};

export type GenerationProviderDefinition = {
  id: string;
  label: string;
  supports: readonly GenerationMediaCapability[];
  modelBindings: readonly GenerationProviderModelBinding[];
  createAdapter: (effect: EffectRecord) => BaseAdapter;
  assertConfigured?: () => Promise<void>;
  validateInput?: (effect: EffectRecord, input: Record<string, unknown>) => void;
};

export type GenerationProviderRegistrar = (
  provider: GenerationProviderDefinition
) => void;
