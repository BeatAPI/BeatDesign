import { getCompatibleDraftModelSettings } from '@/core/beatcanvas/composer';
import type {
  CanvasCardMediaType,
  CanvasGenerationCard,
} from '@/core/beatcanvas/canvas-types';
import { getDraftDefaultsFromModel } from '@/core/beatcanvas/draft-defaults';
import type { ProjectGenerationItem } from '@/core/effects/project-generations';
import {
  findWorkspaceModelOption,
  type WorkspaceModelOption,
} from '@/core/effects/workspace-models';
import type { StudioMedia } from '@/core/studio/studio-runtime';

export const STUDIO_DRAFT_ID = 'studio-draft';

export const createStudioDraftCard = ({
  type,
  model,
  prompt = '',
}: {
  type: CanvasCardMediaType;
  model: WorkspaceModelOption | null;
  prompt?: string;
}): CanvasGenerationCard => {
  const defaults = getDraftDefaultsFromModel(type, model);

  return {
    id: STUDIO_DRAFT_ID,
    kind: 'generation',
    name: 'Studio draft',
    url: null,
    prompt,
    referenceCardIds: [],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    ...defaults,
    type,
    sourceGenerationId: null,
  };
};

export const applyStudioDraftModel = ({
  draft,
  model,
}: {
  draft: CanvasGenerationCard;
  model: WorkspaceModelOption;
}): CanvasGenerationCard => ({
  ...draft,
  modelId: model.id,
  ...getCompatibleDraftModelSettings({
    draftCard: draft,
    model,
  }),
});

export function applyStudioHistoryItem({
  item,
  imageModels,
  videoModels,
}: {
  item: ProjectGenerationItem;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
}): {
  media: StudioMedia;
  draft: CanvasGenerationCard;
  referenceUrls: string[];
} {
  if (item.mediaType === 'analysis') {
    return {
      media: 'analysis',
      draft: createStudioDraftCard({
        type: 'image',
        model: imageModels[0] ?? null,
        prompt: item.prompt ?? '',
      }),
      referenceUrls: item.referenceVideos,
    };
  }

  const media: StudioMedia = item.mediaType === 'video' ? 'video' : 'image';
  const models = media === 'video' ? videoModels : imageModels;
  const model =
    findWorkspaceModelOption(models, item.modelId) ?? models[0] ?? null;
  const draft = createStudioDraftCard({
    type: media,
    model,
    prompt: item.prompt ?? '',
  });
  const nextDraft = model
    ? applyStudioDraftModel({
        draft: {
          ...draft,
          aspectRatio:
            (item.aspectRatio as CanvasGenerationCard['aspectRatio']) ||
            draft.aspectRatio,
          outputQuality:
            (item.outputQuality as CanvasGenerationCard['outputQuality']) ||
            draft.outputQuality,
          mode: (item.mode as CanvasGenerationCard['mode']) || draft.mode,
          duration:
            (item.duration as CanvasGenerationCard['duration']) ||
            draft.duration,
        },
        model,
      })
    : draft;

  return {
    media,
    draft: nextDraft,
    referenceUrls: item.referenceImages,
  };
}
