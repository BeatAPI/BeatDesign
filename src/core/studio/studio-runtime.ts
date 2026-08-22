import {
  getWorkspaceModelsByType,
  type WorkspaceModelOption,
} from '@/core/effects/workspace-models';

export type StudioMedia = 'image' | 'video';

export const getStudioModels = (media: StudioMedia) =>
  getWorkspaceModelsByType(media === 'image' ? 'ai-image' : 'ai-video').filter(
    (model) => model.available !== false
  );

export function buildStudioEffectInput({
  media,
  model,
  prompt,
  aspectRatio,
  duration,
  outputQuality,
  mode,
  quality,
  language,
}: {
  media: StudioMedia;
  model: WorkspaceModelOption;
  prompt: string;
  aspectRatio: string;
  duration?: string;
  outputQuality?: string;
  mode?: string;
  quality?: string;
  language?: string;
}): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    aspect_ratio: aspectRatio,
  };

  if (media === 'image') {
    const nextOutputQuality = outputQuality ?? model.defaultOutputQuality;
    if (nextOutputQuality) input.wmOutputQuality = nextOutputQuality;
    const nextQuality = quality ?? model.defaultQuality;
    if (nextQuality) input.quality = nextQuality;
    return input;
  }

  input.generationType = 'TEXT_2_VIDEO';
  const nextDuration = duration ?? model.defaultDuration;
  if (nextDuration) input.wmDuration = nextDuration;
  const nextMode = mode ?? model.defaultMode;
  if (nextMode) input.mode = nextMode;
  const nextOutputQuality = outputQuality ?? model.defaultOutputQuality;
  if (nextOutputQuality) input.wmOutputQuality = nextOutputQuality;
  const nextLanguage = language ?? model.defaultLanguage;
  if (nextLanguage) input.language = nextLanguage;
  return input;
}
