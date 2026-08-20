import type {
  WorkspaceAspectRatio,
  WorkspaceDuration,
  WorkspaceLanguage,
  WorkspaceModelMode,
  WorkspaceModelVariant,
  WorkspaceOutputQuality,
  WorkspaceQualityOption,
} from '@/core/effects/workspace-models';

export type CanvasCardMediaType = 'image' | 'video';
export type CanvasCardKind = 'asset' | 'generation' | 'output';
export type CanvasCardStatus =
  | 'idle'
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

export type CanvasCard = {
  id: string;
  assetId?: string | null;
  kind: CanvasCardKind;
  type: CanvasCardMediaType;
  name: string;
  url: string | null;
  prompt: string;
  referenceCardIds: string[];
  workflowTemplateId: string | null;
  status: CanvasCardStatus;
  error: string | null;
  modelId: string;
  aspectRatio: WorkspaceAspectRatio;
  outputQuality: WorkspaceOutputQuality;
  duration: WorkspaceDuration;
  language?: WorkspaceLanguage;
  mode: WorkspaceModelMode;
  variant: WorkspaceModelVariant;
  quality: WorkspaceQualityOption;
  sourceGenerationId: string | null;
  sourceConfigCardId?: string | null;
  generationRunId?: string | null;
  generationSnapshot?: CanvasGenerationSnapshot | null;
  /** Generation card: output card id whose result is pinned on the node. */
  pinnedOutputId?: string | null;
};

export type CanvasGenerationSnapshot = Pick<
  CanvasCard,
  | 'type'
  | 'prompt'
  | 'referenceCardIds'
  | 'workflowTemplateId'
  | 'modelId'
  | 'aspectRatio'
  | 'outputQuality'
  | 'duration'
  | 'language'
  | 'mode'
  | 'variant'
  | 'quality'
> & {
  capturedAt: string;
};

export type CanvasGenerationCard = CanvasCard & {
  kind: 'generation';
};

export type CanvasOutputCard = CanvasCard & {
  kind: 'output';
  sourceConfigCardId: string;
  generationRunId: string;
  generationSnapshot: CanvasGenerationSnapshot;
};

export const isCanvasGenerationCard = (
  card: CanvasCard | null | undefined
): card is CanvasGenerationCard => card?.kind === 'generation';

export const isCanvasOutputCard = (
  card: CanvasCard | null | undefined
): card is CanvasOutputCard => card?.kind === 'output';

/** @deprecated Use isCanvasGenerationCard */
export const isCanvasDraftCard = isCanvasGenerationCard;

/** @deprecated Use CanvasGenerationCard */
export type CanvasDraftCard = CanvasGenerationCard;
