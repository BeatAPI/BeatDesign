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
  CanvasGenerationMode,
  CanvasCardMediaType,
  CanvasCardStatus,
  CanvasDraftCard,
  CanvasGenerationCard,
} from './canvas-types';
import { isCanvasAnalysisCard } from './canvas-types';

type DraftModelSettings = Pick<
  CanvasGenerationCard,
  | 'aspectRatio'
  | 'outputQuality'
  | 'duration'
  | 'language'
  | 'mode'
  | 'variant'
  | 'quality'
  | 'characterOrientation'
  | 'backgroundSource'
>;

export type CanvasShortcutContext = {
  tagName?: string | null;
  isContentEditable?: boolean;
  isComposing?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
};

export type DraftReferencePickerOption = {
  intent: CanvasCardMediaType;
  remaining: number | null;
};

const INTERACTIVE_SHORTCUT_TAGS = new Set([
  'A',
  'BUTTON',
  'INPUT',
  'OPTION',
  'SELECT',
  'TEXTAREA',
]);

const NUMERIC_WORKSPACE_ASPECT_RATIOS = [
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '9:16',
  '1:2',
  '9:21',
  '1:3',
  '2:1',
  '3:1',
] as const satisfies readonly WorkspaceAspectRatio[];

const toNumericAspectRatio = (value: WorkspaceAspectRatio) => {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    return width > 0 && height > 0 ? width / height : null;
  }

  if (value === 'landscape') return 16 / 9;
  if (value === 'portrait') return 9 / 16;
  return null;
};

export const resolveWorkspaceAspectRatioFromDimensions = ({
  width,
  height,
  fallback,
}: {
  width: number;
  height: number;
  fallback: WorkspaceAspectRatio;
}): WorkspaceAspectRatio => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return fallback;
  }

  const targetRatio = width / height;
  return NUMERIC_WORKSPACE_ASPECT_RATIOS.reduce((closest, candidate) => {
    const closestRatio = toNumericAspectRatio(closest) ?? targetRatio;
    const candidateRatio = toNumericAspectRatio(candidate) ?? targetRatio;
    const closestDistance = Math.abs(Math.log(targetRatio / closestRatio));
    const candidateDistance = Math.abs(Math.log(targetRatio / candidateRatio));
    return candidateDistance < closestDistance ? candidate : closest;
  });
};

export const resolveReferenceDrivenDraftAspectRatio = ({
  draftCard,
  cards,
  model,
  getReferenceDimensions,
}: {
  draftCard: CanvasGenerationCard;
  cards: Record<string, CanvasCard | undefined>;
  model: WorkspaceModelOption | null;
  getReferenceDimensions?: (
    card: CanvasCard
  ) => { width: number; height: number } | null;
}): WorkspaceAspectRatio => {
  if (
    !model?.characterOrientationOptions?.length ||
    model.supportedAspectRatios?.length
  ) {
    return draftCard.aspectRatio;
  }

  const fallback = model.defaultAspectRatio ?? '16:9';
  const referenceType =
    draftCard.characterOrientation ??
    model.defaultCharacterOrientation ??
    'video';
  const referenceCard = draftCard.referenceCardIds
    .map((cardId) => cards[cardId])
    .find((card): card is CanvasCard => card?.type === referenceType);

  if (!referenceCard) {
    return fallback;
  }

  const dimensions = getReferenceDimensions?.(referenceCard);
  if (dimensions) {
    return resolveWorkspaceAspectRatioFromDimensions({
      ...dimensions,
      fallback,
    });
  }

  return toNumericAspectRatio(referenceCard.aspectRatio)
    ? referenceCard.aspectRatio
    : fallback;
};

const resolveSupportedValue = <T extends string>({
  current,
  supported,
  fallback,
}: {
  current: T;
  supported: readonly T[] | undefined;
  fallback: T | undefined;
}) => {
  if (supported && supported.length > 0) {
    return supported.includes(current) ? current : (fallback ?? supported[0]);
  }

  return fallback ?? current;
};

const getReferenceCounts = ({
  draftCard,
  cards,
}: {
  draftCard: CanvasGenerationCard;
  cards: Record<string, CanvasCard | undefined>;
}) =>
  draftCard.referenceCardIds.reduce(
    (counts, referenceCardId) => {
      const referenceCard = cards[referenceCardId];
      if (!referenceCard) {
        return counts;
      }

      if (referenceCard.type === 'image') {
        counts.image += 1;
      } else if (referenceCard.type === 'video') {
        counts.video += 1;
      }

      return counts;
    },
    {
      image: 0,
      video: 0,
    }
  );

export const isDraftBusyStatus = (status: CanvasCardStatus) =>
  status === 'pending' || status === 'processing';

export const shouldIgnoreCanvasShortcut = ({
  tagName,
  isContentEditable = false,
  isComposing = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  defaultPrevented = false,
}: CanvasShortcutContext) => {
  if (defaultPrevented || isComposing || altKey || ctrlKey || metaKey) {
    return true;
  }

  if (isContentEditable) {
    return true;
  }

  if (!tagName) {
    return false;
  }

  return INTERACTIVE_SHORTCUT_TAGS.has(tagName.toUpperCase());
};

export const getDraftReferencePickerOptions = ({
  draftCard,
  cards,
  model,
}: {
  draftCard: CanvasGenerationCard;
  cards: Record<string, CanvasCard | undefined>;
  model: WorkspaceModelOption | null;
}): DraftReferencePickerOption[] => {
  const referenceCounts = getReferenceCounts({ draftCard, cards });
  if (isCanvasAnalysisCard(draftCard)) {
    const videoRemaining = Math.max(1 - referenceCounts.video, 0);
    return videoRemaining > 0
      ? [{ intent: 'video', remaining: videoRemaining }]
      : [];
  }

  if (!model) {
    return [];
  }

  const imageLimit = Math.max(model.maxReferenceImages ?? 0, 0);
  const imageRemaining = Math.max(imageLimit - referenceCounts.image, 0);
  const videoLimit = Math.max(model.maxSourceVideos ?? 0, 0);
  const videoRemaining = Math.max(videoLimit - referenceCounts.video, 0);
  const options: DraftReferencePickerOption[] = [];

  if (imageRemaining > 0) {
    options.push({
      intent: 'image',
      remaining: imageRemaining,
    });
  }

  if (videoRemaining > 0) {
    options.push({
      intent: 'video',
      remaining: videoRemaining,
    });
  }

  return options;
};

export const canUseCanvasCardAsGenerationReference = ({
  sourceCard,
  targetType,
  targetModel,
  targetGenerationMode,
}: {
  sourceCard: CanvasCard;
  targetType: CanvasCardMediaType;
  targetModel: WorkspaceModelOption | null;
  targetGenerationMode?: CanvasGenerationMode;
}) => {
  if (targetGenerationMode === 'analysis') {
    return sourceCard.type === 'video';
  }

  if (sourceCard.type === 'image') {
    return true;
  }

  return (
    sourceCard.type === 'video' &&
    targetType === 'video' &&
    targetModel?.supportsSourceVideo === true
  );
};

export const listCompatibleCanvasReferenceCards = ({
  draftCard,
  cards,
  model,
}: {
  draftCard: CanvasGenerationCard;
  cards: Record<string, CanvasCard | undefined>;
  model: WorkspaceModelOption | null;
}) => {
  const attachedIds = new Set(draftCard.referenceCardIds);
  const referenceCounts = getReferenceCounts({ draftCard, cards });
  const isAnalysis = isCanvasAnalysisCard(draftCard);
  const imageRemaining = Math.max(
    (model?.maxReferenceImages ?? 0) - referenceCounts.image,
    0
  );
  const videoRemaining = Math.max(
    (model?.maxSourceVideos ?? 0) - referenceCounts.video,
    0
  );

  return Object.values(cards).filter(
    (card): card is CanvasCard & { type: CanvasCardMediaType } => {
    if (
      !card ||
      (card.type !== 'image' && card.type !== 'video') ||
      card.id === draftCard.id
    ) {
      return false;
    }

    if (card.kind === 'output' && !isAnalysis) {
      return false;
    }

    if (!card.url || attachedIds.has(card.id)) {
      return false;
    }

    if (isAnalysis) {
      return card.type === 'video' && referenceCounts.video < 1;
    }

    if (
      card.type === 'image' &&
      imageRemaining <= 0
    ) {
      return false;
    }

    if (
      card.type === 'video' &&
      (videoRemaining <= 0 || !model?.supportsSourceVideo)
    ) {
      return false;
    }

    return canUseCanvasCardAsGenerationReference({
      sourceCard: card,
      targetType: draftCard.type,
      targetModel: model,
      targetGenerationMode: draftCard.generationMode,
    });
    }
  );
};

export const removeReferenceCardId = (
  referenceCardIds: string[],
  cardId: string
) => referenceCardIds.filter((referenceCardId) => referenceCardId !== cardId);

export const shouldIgnoreCanvasModifierShortcut = ({
  tagName,
  isContentEditable = false,
  isComposing = false,
  defaultPrevented = false,
}: CanvasShortcutContext) => {
  if (defaultPrevented || isComposing || isContentEditable) {
    return true;
  }

  if (!tagName) {
    return false;
  }

  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

export const appendUniqueReferenceCardId = (
  referenceCardIds: string[],
  nextReferenceCardId: string
) =>
  referenceCardIds.includes(nextReferenceCardId)
    ? referenceCardIds
    : [...referenceCardIds, nextReferenceCardId];

export const getCompatibleDraftModelSettings = ({
  draftCard,
  model,
}: {
  draftCard: DraftModelSettings;
  model: WorkspaceModelOption;
}): DraftModelSettings => ({
  aspectRatio: resolveSupportedValue<WorkspaceAspectRatio>({
    current: draftCard.aspectRatio,
    supported: model.supportedAspectRatios,
    fallback: model.defaultAspectRatio,
  }),
  outputQuality: resolveSupportedValue<WorkspaceOutputQuality>({
    current: draftCard.outputQuality,
    supported: model.supportedOutputQualities,
    fallback: model.defaultOutputQuality,
  }),
  duration: resolveSupportedValue<WorkspaceDuration>({
    current: draftCard.duration,
    supported: model.supportedDurations,
    fallback: model.defaultDuration,
  }),
  language:
    model.supportedLanguages && model.supportedLanguages.length > 0
      ? resolveSupportedValue<WorkspaceLanguage>({
          current: draftCard.language ?? model.defaultLanguage ?? 'en',
          supported: model.supportedLanguages,
          fallback: model.defaultLanguage,
        })
      : undefined,
  mode: resolveSupportedValue<WorkspaceModelMode>({
    current: draftCard.mode,
    supported: model.modeOptions,
    fallback: model.defaultMode,
  }),
  variant: resolveSupportedValue<WorkspaceModelVariant>({
    current: draftCard.variant,
    supported: model.variantOptions,
    fallback: model.defaultVariant,
  }),
  quality: resolveSupportedValue<WorkspaceQualityOption>({
    current: draftCard.quality,
    supported: model.qualityOptions,
    fallback: model.defaultQuality,
  }),
  characterOrientation:
    model.characterOrientationOptions &&
    model.characterOrientationOptions.length > 0
      ? resolveSupportedValue<WorkspaceCharacterOrientation>({
          current:
            draftCard.characterOrientation ??
            model.defaultCharacterOrientation ??
            'video',
          supported: model.characterOrientationOptions,
          fallback: model.defaultCharacterOrientation,
        })
      : undefined,
  backgroundSource:
    model.backgroundSourceOptions && model.backgroundSourceOptions.length > 0
      ? resolveSupportedValue<WorkspaceBackgroundSource>({
          current:
            draftCard.backgroundSource ??
            model.defaultBackgroundSource ??
            'input_video',
          supported: model.backgroundSourceOptions,
          fallback: model.defaultBackgroundSource,
        })
      : undefined,
});
