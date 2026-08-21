'use client';

import {
  composerFieldButtonClassName,
  composerFloatingPanelClassName,
  composerSectionLabelClassName,
  getComposerOptionRowClassName,
  getComposerParameterChipClassName,
} from '@/components/app/composer-styles';
import type {
  CanvasCard,
  CanvasGenerationCard,
} from '@/core/beatcanvas/canvas-types';
import type { CanvasLabels } from './beatcanvas-front-layer-context';

export const compactParameterGroupClass = 'flex flex-wrap gap-1.5';

export const composerFieldSlotClassName =
  'relative w-auto min-w-0 flex-none';

// Shared BeatAPI composer vocabulary — see @/components/app/composer-styles.
export {
  composerFieldButtonClassName,
  composerFloatingPanelClassName,
  composerSectionLabelClassName,
  getComposerOptionRowClassName,
};

export const getParameterChipClassName = getComposerParameterChipClassName;

export const normalizeComposerToken = (
  value: string,
  labels?: Pick<
    CanvasLabels,
    | 'tokenQualityLabel'
    | 'tokenFastLabel'
    | 'tokenLiteLabel'
    | 'tokenLowLabel'
    | 'tokenMediumLabel'
    | 'tokenStandardLabel'
    | 'tokenHighLabel'
    | 'tokenProLabel'
    | 'tokenAdaptiveLabel'
    | 'tokenAutoLabel'
    | 'tokenLandscapeLabel'
    | 'tokenPortraitLabel'
    | 'tokenChineseLabel'
    | 'tokenEnglishLabel'
    | 'tokenImageOrientationLabel'
    | 'tokenVideoOrientationLabel'
    | 'tokenInputImageLabel'
    | 'tokenInputVideoLabel'
  >
) => {
  switch (value) {
    case 'quality':
      return labels?.tokenQualityLabel ?? 'Quality';
    case 'fast':
      return labels?.tokenFastLabel ?? 'Fast';
    case 'lite':
      return labels?.tokenLiteLabel ?? 'Lite';
    case 'low':
      return labels?.tokenLowLabel ?? 'Low';
    case 'medium':
      return labels?.tokenMediumLabel ?? 'Medium';
    case 'standard':
      return labels?.tokenStandardLabel ?? 'Standard';
    case 'high':
      return labels?.tokenHighLabel ?? 'High';
    case 'pro':
      return labels?.tokenProLabel ?? 'Pro';
    case 'adaptive':
      return labels?.tokenAdaptiveLabel ?? 'Adaptive';
    case 'auto':
      return labels?.tokenAutoLabel ?? 'Auto';
    case 'landscape':
      return labels?.tokenLandscapeLabel ?? 'Landscape';
    case 'portrait':
      return labels?.tokenPortraitLabel ?? 'Portrait';
    case 'zh':
      return labels?.tokenChineseLabel ?? 'Chinese';
    case 'en':
      return labels?.tokenEnglishLabel ?? 'English';
    case 'image':
      return labels?.tokenImageOrientationLabel ?? 'Image orientation';
    case 'video':
      return labels?.tokenVideoOrientationLabel ?? 'Video orientation';
    case 'input_image':
      return labels?.tokenInputImageLabel ?? 'Image background';
    case 'input_video':
      return labels?.tokenInputVideoLabel ?? 'Video background';
    default:
      if (/^\d+(?:k|p)$/i.test(value)) {
        return value.toUpperCase();
      }

      return value
        .split(/[-_]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

export const stopComposerEvent = <T extends { stopPropagation: () => void }>(
  event: T
) => {
  event.stopPropagation();
};

export const stopComposerKeyboardEvent = <
  T extends {
    stopPropagation: () => void;
    nativeEvent?: { stopImmediatePropagation?: () => void };
  },
>(
  event: T
) => {
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation?.();
};

export const resolveAnchoredComposerPosition = ({
  frame,
  viewportWidth,
  preferredWidth = 560,
  edgeInset = 16,
  gap = 14,
}: {
  frame: { left: number; top: number; width: number; height: number };
  viewportWidth: number;
  preferredWidth?: number;
  edgeInset?: number;
  gap?: number;
}) => {
  const availableWidth = Math.max(0, viewportWidth - edgeInset * 2);
  const composerWidth = Math.min(preferredWidth, availableWidth);
  const preferredLeft = frame.left + frame.width / 2 - composerWidth / 2;
  const maximumLeft = Math.max(
    edgeInset,
    viewportWidth - edgeInset - composerWidth
  );

  return {
    left: Math.min(Math.max(preferredLeft, edgeInset), maximumLeft),
    top: frame.top + frame.height + gap,
  };
};

export const resolveComposerFocusLayout = ({
  frameHeight,
  viewportHeight,
  composerHeight,
  currentZoom,
  zoomSteps,
  edgeInset = 16,
  titleHeight = 28,
  gap = 14,
}: {
  frameHeight: number;
  viewportHeight: number;
  composerHeight: number;
  currentZoom: number;
  zoomSteps: number[];
  edgeInset?: number;
  titleHeight?: number;
  gap?: number;
}) => {
  const availableFrameHeight = Math.max(
    0,
    viewportHeight - edgeInset * 2 - titleHeight - gap - composerHeight
  );
  const maximumZoom =
    frameHeight > 0 ? availableFrameHeight / frameHeight : currentZoom;
  const shouldReduceZoom = currentZoom > maximumZoom;
  const eligibleZoomSteps = zoomSteps.filter(
    (step) => step <= maximumZoom + 0.01
  );
  const nextZoom = shouldReduceZoom
    ? (eligibleZoomSteps.at(-1) ?? zoomSteps[0] ?? currentZoom)
    : currentZoom;

  return {
    zoom: nextZoom,
    verticalPageOffset:
      (gap + composerHeight - titleHeight) / (2 * Math.max(nextZoom, 0.01)),
  };
};

export const resolveComposerPopoverStateOnPointerDown = ({
  isTypeSelectOpen,
  isModelSelectOpen,
  isParameterPopoverOpen,
  isReferencePickerOpen,
  isVersionPickerOpen = false,
  isWithinComposer,
  isWithinTypePicker,
  isWithinModelPicker,
  isWithinParameterPicker,
  isWithinReferencePicker,
  isWithinVersionPicker = false,
}: {
  isTypeSelectOpen: boolean;
  isModelSelectOpen: boolean;
  isParameterPopoverOpen: boolean;
  isReferencePickerOpen: boolean;
  isVersionPickerOpen?: boolean;
  isWithinComposer: boolean;
  isWithinTypePicker: boolean;
  isWithinModelPicker: boolean;
  isWithinParameterPicker: boolean;
  isWithinReferencePicker: boolean;
  isWithinVersionPicker?: boolean;
}) => {
  if (!isWithinComposer) {
    return {
      isTypeSelectOpen: false,
      isModelSelectOpen: false,
      isParameterPopoverOpen: false,
      isReferencePickerOpen: false,
      isVersionPickerOpen: false,
    };
  }

  return {
    isTypeSelectOpen: isWithinTypePicker ? isTypeSelectOpen : false,
    isModelSelectOpen: isWithinModelPicker ? isModelSelectOpen : false,
    isParameterPopoverOpen: isWithinParameterPicker
      ? isParameterPopoverOpen
      : false,
    isReferencePickerOpen: isWithinReferencePicker
      ? isReferencePickerOpen
      : false,
    isVersionPickerOpen: isWithinVersionPicker ? isVersionPickerOpen : false,
  };
};

export const getDraftStatusLabel = (
  card: CanvasGenerationCard,
  labels?: Pick<
    CanvasLabels,
    | 'queuedStatusLabel'
    | 'generatingStatusLabel'
    | 'readyStatusLabel'
    | 'failedStatusLabel'
  >
) => {
  if (card.error?.trim()) {
    return card.error.trim();
  }

  switch (card.status) {
    case 'pending':
      return labels?.queuedStatusLabel ?? 'Queued';
    case 'processing':
      return labels?.generatingStatusLabel ?? 'Generating';
    case 'succeeded':
      return labels?.readyStatusLabel ?? 'Ready';
    case 'failed':
      return labels?.failedStatusLabel ?? 'Failed';
    default:
      return '';
  }
};

export const isDraftCard = (
  card: CanvasCard | null | undefined
): card is CanvasGenerationCard => card?.kind === 'generation';
