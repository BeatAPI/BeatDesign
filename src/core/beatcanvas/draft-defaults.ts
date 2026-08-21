import {
  type WorkspaceModelOption,
  getDefaultSelectableWorkspaceModel,
} from '@/core/effects/workspace-models';
import type { CanvasCardMediaType } from '@/core/beatcanvas/canvas-types';

export const getDraftDefaultsFromModel = (
  taskType: CanvasCardMediaType,
  model: WorkspaceModelOption | null
) => ({
  type: taskType,
  modelId:
    model?.id ??
    (taskType === 'image'
      ? getDefaultSelectableWorkspaceModel('ai-image')?.id
      : getDefaultSelectableWorkspaceModel('ai-video')?.id) ??
    '',
  aspectRatio:
    model?.defaultAspectRatio ?? (taskType === 'image' ? '1:1' : '16:9'),
  outputQuality:
    model?.defaultOutputQuality ?? (taskType === 'image' ? '1k' : '1080p'),
  duration: model?.defaultDuration ?? '5s',
  language: model?.defaultLanguage,
  mode: model?.defaultMode ?? 'quality',
  variant: model?.defaultVariant ?? 'standard',
  quality: model?.defaultQuality ?? 'standard',
  characterOrientation: model?.defaultCharacterOrientation,
  backgroundSource: model?.defaultBackgroundSource,
});
