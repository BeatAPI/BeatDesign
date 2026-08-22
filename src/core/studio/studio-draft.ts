import { getCompatibleDraftModelSettings } from '@/core/beatcanvas/composer';
import type {
  CanvasCardMediaType,
  CanvasGenerationCard,
} from '@/core/beatcanvas/canvas-types';
import { getDraftDefaultsFromModel } from '@/core/beatcanvas/draft-defaults';
import type { WorkspaceModelOption } from '@/core/effects/workspace-models';

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
