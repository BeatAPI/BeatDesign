import type {
  WorkspaceAspectRatio,
  WorkspaceBackgroundSource,
  WorkspaceCharacterOrientation,
  WorkspaceDuration,
  WorkspaceLanguage,
  WorkspaceModelMode,
  WorkspaceModelVariant,
  WorkspaceOutputQuality,
  WorkspaceQualityOption,
} from '@/core/effects/workspace-models';
import type { VideoAnalysisDepth } from '@/core/effects/video-analysis';

export type CanvasCardMediaType = 'image' | 'video';
export type CanvasGenerationMode = CanvasCardMediaType | 'analysis';
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
  generationMode?: CanvasGenerationMode;
  analysisDepth?: VideoAnalysisDepth;
  name: string;
  url: string | null;
  resultText?: string | null;
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
  characterOrientation?: WorkspaceCharacterOrientation;
  backgroundSource?: WorkspaceBackgroundSource;
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
  | 'generationMode'
  | 'analysisDepth'
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
  | 'characterOrientation'
  | 'backgroundSource'
  | 'resultText'
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

export const getCanvasGenerationMode = (
  card: Pick<CanvasCard, 'type' | 'generationMode'>
): CanvasGenerationMode => card.generationMode ?? card.type;

export const isCanvasAnalysisCard = (
  card: CanvasCard | null | undefined
) => Boolean(card && getCanvasGenerationMode(card) === 'analysis');
