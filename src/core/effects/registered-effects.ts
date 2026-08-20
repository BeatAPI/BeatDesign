import type { EffectRecord } from '@/core/adapters/base-adapter';

import {
  type WorkspaceEffectRegistryEntry,
  WORKSPACE_EFFECT_REGISTRY,
  getWorkspaceEffectRegistryEntryByEffectId,
} from './effect-registry';
import { getWorkspaceMediaSchema } from './workspace-media';

export type RegisteredEffect = EffectRecord;

const optionalAnyField = { type: 'any', required: false } as const;

const buildInputSchema = (entry: WorkspaceEffectRegistryEntry) => {
  const mediaSchema = getWorkspaceMediaSchema(entry.id);
  const schema: Record<string, unknown> = {
    prompt: { type: 'string', required: true },
  };

  if (entry.supportedAspectRatios?.length) {
    schema.aspect_ratio = {
      type: 'enum',
      required: false,
      values: entry.supportedAspectRatios,
    };
  }
  if (entry.supportedDurations?.length) {
    schema.wmDuration = {
      type: 'enum',
      required: false,
      values: entry.supportedDurations,
    };
  }
  if (entry.supportedOutputQualities?.length) {
    schema.wmOutputQuality = {
      type: 'enum',
      required: false,
      values: entry.supportedOutputQualities,
    };
  }
  if (entry.qualityOptions?.length) {
    schema.quality = {
      type: 'enum',
      required: false,
      values: entry.qualityOptions,
    };
  }
  if (entry.modeOptions?.length) {
    schema.mode = {
      type: 'enum',
      required: false,
      values: entry.modeOptions,
    };
  }
  if (entry.supportedLanguages?.length) {
    schema.language = {
      type: 'enum',
      required: false,
      values: entry.supportedLanguages,
    };
  }
  if (mediaSchema && mediaSchema.image.max > 0) {
    schema.image_urls = optionalAnyField;
  }
  if (mediaSchema && mediaSchema.video.max > 0) {
    schema.video_urls = optionalAnyField;
  }
  if (mediaSchema && mediaSchema.audio.max > 0) {
    schema.audio_urls = optionalAnyField;
  }

  return schema;
};

export const toRegisteredEffect = (
  entry: WorkspaceEffectRegistryEntry
): RegisteredEffect => {
  const isImage = entry.workspaceType === 'ai-image';

  return {
    id: entry.effectId,
    name: entry.name,
    type: isImage ? 2 : 1,
    model: entry.id,
    version: null,
    linkName: entry.routeSlug ?? entry.id,
    description: `BeatAPI ${entry.name}`,
    platform: 'beatapi',
    api: isImage
      ? 'https://api.beatapi.io/v1/images/tasks'
      : 'https://api.beatapi.io/v1/videos/tasks',
    provider: 'beatapi',
    inputSchema: buildInputSchema(entry),
  };
};

export const listRegisteredEffects = (): RegisteredEffect[] =>
  WORKSPACE_EFFECT_REGISTRY.map(toRegisteredEffect);

export const getRegisteredEffectById = (
  id: number
): RegisteredEffect | null => {
  const entry = getWorkspaceEffectRegistryEntryByEffectId(id);
  return entry ? toRegisteredEffect(entry) : null;
};

export const getRegisteredEffectsByIds = (ids: number[]): RegisteredEffect[] => {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id));
  return uniqueIds.flatMap((id) => {
    const effect = getRegisteredEffectById(id);
    return effect ? [effect] : [];
  });
};
