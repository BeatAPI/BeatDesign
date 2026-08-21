import type { EffectMetadata } from '@/core/effects/client-api';
import type {
  WorkspaceAspectRatio,
  WorkspaceBackgroundSource,
  WorkspaceCharacterOrientation,
  WorkspaceDuration,
  WorkspaceLanguage,
  WorkspaceModelMode,
  WorkspaceModelOption,
  WorkspaceModelVariant,
  WorkspaceOutputQuality,
  WorkspaceQualityOption,
} from '@/core/effects/workspace-models';
import type {
  CanvasCard,
  CanvasCardMediaType,
  CanvasGenerationCard,
} from '@/core/beatcanvas/canvas-types';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

/**
 * Product-facing canvas state and actions. The rendering engine consumes this
 * context without taking ownership of workflows, prompts, or persistence.
 */

type CanvasLabels = {
  imageTitle: string;
  videoTitle: string;
  imageModeLabel: string;
  videoModeLabel: string;
  createGenerationCardLabel: string;
  createImageGenerationCardLabel: string;
  createVideoGenerationCardLabel: string;
  connectorUploadLabel: string;
  imagePromptPlaceholder: string;
  videoPromptPlaceholder: string;
  zoomLabel: string;
  zoomOutLabel: string;
  zoomInLabel: string;
  selectToolLabel: string;
  panToolLabel: string;
  fitViewLabel: string;
  hideEdgesLabel: string;
  showEdgesLabel: string;
  snapToGridLabel: string;
  undoLabel: string;
  redoLabel: string;
  historyLabel: string;
  latestResultLabel: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  emptyGuideTitle: string;
  emptyGuideDescription: string;
  emptyFreeGenerateLabel: string;
  emptyUploadStartLabel: string;
  typeLabel: string;
  modelLabel: string;
  parameterLabel: string;
  aspectRatioLabel: string;
  outputQualityLabel: string;
  durationLabel: string;
  characterOrientationLabel: string;
  backgroundSourceLabel: string;
  languageLabel: string;
  uploadImageLabel: string;
  uploadVideoLabel: string;
  fromCanvasLabel: string;
  currentReferencesLabel: string;
  noCanvasReferencesLabel: string;
  removeReferenceLabel: string;
  generateLabel: string;
  regenerateLabel: string;
  generatingLabel: string;
  closeComposerLabel: string;
  defaultSetupLabel: string;
  modeOptionLabel: string;
  variantOptionLabel: string;
  qualityOptionLabel: string;
  tokenQualityLabel: string;
  tokenFastLabel: string;
  tokenLiteLabel: string;
  tokenLowLabel: string;
  tokenMediumLabel: string;
  tokenStandardLabel: string;
  tokenHighLabel: string;
  tokenProLabel: string;
  tokenAdaptiveLabel: string;
  tokenAutoLabel: string;
  tokenLandscapeLabel: string;
  tokenPortraitLabel: string;
  tokenChineseLabel: string;
  tokenEnglishLabel: string;
  tokenImageOrientationLabel: string;
  tokenVideoOrientationLabel: string;
  tokenInputImageLabel: string;
  tokenInputVideoLabel: string;
  queuedStatusLabel: string;
  generatingStatusLabel: string;
  readyStatusLabel: string;
  failedStatusLabel: string;
};

export type { CanvasLabels };

export type BeatCanvasComposerPresentation = {
  kind: 'default';
};

export type BeatCanvasFrontLayerValue = {
  cards: Record<string, CanvasCard>;
  selectedShapeIds: string[];
  selectedCanvasCardIds: string[];
  activeComposerCardId: string | null;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  effectMetadataMap: Record<number, EffectMetadata>;
  labels: CanvasLabels;
  composerPresentation: BeatCanvasComposerPresentation | null;

  promptCharacterLimit: number;
  canUndoCanvas: boolean;
  canRedoCanvas: boolean;
  onUndoCanvas: () => void;
  onRedoCanvas: () => void;
  onCreateImageDraft: () => void;
  onUploadImage: () => void;
  onCreateGenerationFromConnector: (input: {
    sourceCardId: string;
    taskType: CanvasCardMediaType;
    pagePoint: {
      x: number;
      y: number;
    };
  }) => void;
  onCreateGenerationAtPoint: (input: {
    taskType: CanvasCardMediaType;
    pagePoint: {
      x: number;
      y: number;
    };
  }) => void;
  onSelectedShapeIdsChange: (shapeIds: string[]) => void;
  onSelectedCanvasCardIdsChange: (shapeIds: string[]) => void;
  onActiveComposerCardIdChange: (cardId: string | null) => void;
  onDraftPromptChange: (draftId: string, prompt: string) => void;
  onDraftTaskTypeChange: (
    draftId: string,
    taskType: CanvasCardMediaType
  ) => void;
  onDraftModelChange: (
    draftId: string,
    modelId: string,
    variant?: WorkspaceModelVariant
  ) => void;
  onDraftAspectRatioChange: (
    draftId: string,
    aspectRatio: WorkspaceAspectRatio
  ) => void;
  onDraftOutputQualityChange: (
    draftId: string,
    quality: WorkspaceOutputQuality
  ) => void;
  onDraftQualityChange: (draftId: string, quality: WorkspaceQualityOption) => void;
  onDraftDurationChange: (draftId: string, duration: WorkspaceDuration) => void;
  onDraftCharacterOrientationChange: (
    draftId: string,
    characterOrientation: WorkspaceCharacterOrientation
  ) => void;
  onDraftBackgroundSourceChange: (
    draftId: string,
    backgroundSource: WorkspaceBackgroundSource
  ) => void;
  onDraftLanguageChange: (draftId: string, language: WorkspaceLanguage) => void;
  onDraftModeChange: (draftId: string, mode: WorkspaceModelMode) => void;
  onDraftVariantChange: (
    draftId: string,
    variant: WorkspaceModelVariant
  ) => void;
  onOpenReferencePicker: (
    draftId: string,
    intent: CanvasGenerationCard['type']
  ) => void;
  onAttachCanvasReference: (draftId: string, sourceCardId: string) => void;
  onDetachCanvasReference: (draftId: string, sourceCardId: string) => void;
  onReorderCanvasReferences: (
    draftId: string,
    activeCardId: string,
    overCardId: string
  ) => void;
  onPinGenerationOutput: (draftId: string, outputId: string) => void;
  onGenerateDraft: (draftId: string) => void;
};

export const CanvasFrontLayerContext =
  createContext<BeatCanvasFrontLayerValue | null>(null);

export function BeatCanvasFrontLayerProvider({
  value,
  children,
}: {
  value: BeatCanvasFrontLayerValue;
  children: ReactNode;
}) {
  return (
    <CanvasFrontLayerContext.Provider value={value}>
      {children}
    </CanvasFrontLayerContext.Provider>
  );
}

export function useCanvasFrontLayer() {
  const context = useContext(CanvasFrontLayerContext);
  if (!context) {
    throw new Error('BeatCanvasFrontLayerProvider is missing.');
  }
  return context;
}
