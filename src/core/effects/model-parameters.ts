import type { CanvasDraftCard } from '@/core/beatcanvas/canvas-types';
import { resolveWorkspaceEffectProviderModelVariant } from './effect-registry';

export function hasModelParameter(schema: unknown, field: string) {
  return Boolean(schema && typeof schema === 'object' && Object.prototype.hasOwnProperty.call(schema, field));
}

export function buildDraftModelParameters(draft: CanvasDraftCard, schema: unknown) {
  const candidates: Record<string, unknown> = {
    aspect_ratio: draft.aspectRatio,
    wmOutputQuality: draft.outputQuality,
    quality: draft.quality,
    ...(draft.type === 'video' ? {
      wmDuration: draft.duration,
      language: draft.language,
      mode: draft.mode,
      size: draft.quality,
      ...(hasModelParameter(schema, 'modelVariant') ? {
        modelVariant: resolveWorkspaceEffectProviderModelVariant({ modelId: draft.modelId, variant: draft.variant }),
      } : {}),
    } : {}),
  };
  return Object.fromEntries(Object.entries(candidates).filter(([key, value]) => value !== undefined && hasModelParameter(schema, key)));
}
