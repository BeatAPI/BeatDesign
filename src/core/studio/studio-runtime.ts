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
}: {
  media: StudioMedia;
  model: WorkspaceModelOption;
  prompt: string;
  aspectRatio: string;
}): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    aspect_ratio: aspectRatio,
  };

  if (media === 'image') {
    if (model.defaultOutputQuality) {
      input.wmOutputQuality = model.defaultOutputQuality;
    }
    if (model.defaultQuality) input.quality = model.defaultQuality;
    return input;
  }

  input.generationType = 'TEXT_2_VIDEO';
  if (model.defaultDuration) input.wmDuration = model.defaultDuration;
  if (model.defaultMode) input.mode = model.defaultMode;
  if (model.defaultOutputQuality) {
    input.wmOutputQuality = model.defaultOutputQuality;
  }
  if (model.defaultLanguage) input.language = model.defaultLanguage;
  return input;
}
