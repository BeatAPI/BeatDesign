import type {
  WorkspaceAspectRatio,
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
  CanvasCardStatus,
  CanvasDraftCard,
  CanvasGenerationCard,
} from './canvas-types';

type DraftModelSettings = Pick<
  CanvasGenerationCard,
  | 'aspectRatio'
  | 'outputQuality'
  | 'duration'
  | 'language'
  | 'mode'
  | 'variant'
  | 'quality'
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
  if (!model) {
    return [];
  }

  const referenceCounts = getReferenceCounts({ draftCard, cards });
  const videoLimit = Math.max(model.maxSourceVideos ?? 0, 0);
  const videoRemaining = Math.max(videoLimit - referenceCounts.video, 0);
  const options: DraftReferencePickerOption[] = [
    {
      intent: 'image',
      remaining: null,
    },
  ];

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
}: {
  sourceCard: CanvasCard;
  targetType: CanvasCardMediaType;
  targetModel: WorkspaceModelOption | null;
}) => {
  if (sourceCard.type === 'image') {
    return true;
  }

  return targetType === 'video' && targetModel?.supportsSourceVideo === true;
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
  const videoRemaining = Math.max(
    (model?.maxSourceVideos ?? 0) - referenceCounts.video,
    0
  );

  return Object.values(cards).filter((card): card is CanvasCard => {
    if (!card || card.id === draftCard.id || card.kind === 'output') {
      return false;
    }

    if (!card.url || attachedIds.has(card.id)) {
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
    });
  });
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
});
