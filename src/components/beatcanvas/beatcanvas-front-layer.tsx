'use client';

import {
  countPromptCharacters,
  truncatePromptToMaxChars,
} from '@/core/effects/validation';
import { findWorkspaceModelOption } from '@/core/effects/workspace-models';
import { cn } from '@/lib/utils';
import { StudioStartHere } from '@/components/studio/studio-start-here';
import {
  getDraftReferencePickerOptions,
  isDraftBusyStatus,
  listCompatibleCanvasReferenceCards,
} from '@/core/beatcanvas/composer';
import { buildCanvasReferenceMentions } from '@/core/beatcanvas/reference-mentions';

import {
  listGenerationOutputsForDraft,
  resolvePinnedGenerationOutputId,
} from '@/core/beatcanvas/generation-history';
import {
  EyeOff,
  Focus,
  Hand,
  Magnet,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useCanvasEngine,
  useCanvasEngineValue,
} from './canvas-engine/canvas-engine-context';
import { BeatCanvasComposerModelPicker } from './beatcanvas-composer-model-picker';
import { BeatCanvasComposerParameterPicker } from './beatcanvas-composer-parameter-picker';
import { BeatCanvasComposerReferencePicker } from './beatcanvas-composer-reference-picker';
import { BeatCanvasComposerShell } from './beatcanvas-composer-shell';
import { BeatCanvasComposerTypePicker } from './beatcanvas-composer-type-picker';
import { BeatCanvasComposerVersionPicker } from './beatcanvas-composer-version-picker';
import {
  isDraftCard,
  normalizeComposerToken,
  resolveAnchoredComposerPosition,
  resolveComposerFocusLayout,
  resolveComposerPopoverStateOnPointerDown,
} from './beatcanvas-composer-utils';
import { useCanvasFrontLayer } from './beatcanvas-front-layer-context';
import { CardConnectorOverlay } from './beatcanvas-card-connector-overlay';
import { beatcanvasPanelClassName } from './beatcanvas-theme';

export type { BeatCanvasFrontLayerValue } from './beatcanvas-front-layer-context';

const VISUGEN_ZOOM_STEPS = [
  0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.4, 2.8, 3.2, 3.6, 4,
];


function areZoomStepsEqual(current: number[] | undefined, next: number[]) {
  return (
    Array.isArray(current) &&
    current.length === next.length &&
    current.every((step, index) => step === next[index])
  );
}

function resolveExplicitAspectRatio(value: string) {
  const numericRatio = /^(\d+):(\d+)$/.exec(value);
  if (numericRatio) {
    const width = Number(numericRatio[1]);
    const height = Number(numericRatio[2]);
    return width > 0 && height > 0 ? width / height : null;
  }

  if (value === 'landscape') return 16 / 9;
  if (value === 'portrait') return 9 / 16;
  return null;
}

export function BeatCanvasFrontLayer() {
  const { editor } = useCanvasEngine();
  const {
    cards,
    activeComposerCardId,
    composerPresentation,
    effectMetadataMap,
    imageModels,
    labels,
    canUndoCanvas,
    canRedoCanvas,
    onUndoCanvas,
    onRedoCanvas,
    onActiveComposerCardIdChange,
    onSelectedShapeIdsChange,
    onDraftAspectRatioChange,
    onDraftBackgroundSourceChange,
    onDraftCharacterOrientationChange,
    onDraftDurationChange,
    onDraftLanguageChange,
    onDraftModeChange,
    onDraftModelChange,
    onDraftOutputQualityChange,
    onDraftPromptChange,
    onDraftQualityChange,
    onDraftTaskTypeChange,
    onDraftVariantChange,
    onOpenReferencePicker,
    onAttachCanvasReference,
    onDetachCanvasReference,
    onReorderCanvasReferences,
    onPinGenerationOutput,
    onGenerateDraft,
    onSelectedCanvasCardIdsChange,
    promptCharacterLimit,
    videoModels,
  } = useCanvasFrontLayer();
  const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [isParameterPopoverOpen, setIsParameterPopoverOpen] = useState(false);
  const [isReferencePickerOpen, setIsReferencePickerOpen] = useState(false);
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false);
  const [promptInputValue, setPromptInputValue] = useState('');
  const [isPromptComposing, setIsPromptComposing] = useState(false);
  const [activeCanvasTool, setActiveCanvasTool] = useState<'select' | 'pan'>(
    'select'
  );
  const [edgesVisible, setEdgesVisible] = useState(true);
  const [isSnapToGridActive, setIsSnapToGridActive] = useState(false);
  const composerRef = useRef<HTMLElement | null>(null);
  const frontLayerRef = useRef<HTMLDivElement | null>(null);
  const typePickerRef = useRef<HTMLDivElement | null>(null);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const parameterPickerRef = useRef<HTMLDivElement | null>(null);
  const referencePickerRef = useRef<HTMLDivElement | null>(null);
  const versionPickerRef = useRef<HTMLDivElement | null>(null);
  const lastComposerFocusSignatureRef = useRef('');

  const selectedShapeIds = useCanvasEngineValue(
    (currentEditor) => currentEditor.getSelectedShapeIds(),
    [cards]
  );
  const selectedCardIds = useMemo(
    () => selectedShapeIds.filter((shapeId) => Boolean(cards[shapeId])),
    [cards, selectedShapeIds]
  );
  const selectedCardIdsKey = selectedCardIds.join(',');
  const zoomLevel = useCanvasEngineValue(
    (currentEditor) =>
      Math.round(
        ((typeof currentEditor.getZoomLevel === 'function'
          ? currentEditor.getZoomLevel()
          : 1) || 1) * 100
      )
  );
  const camera = useCanvasEngineValue((currentEditor) =>
    currentEditor.getCamera()
  );
  const frameToViewportRect = useMemo(
    () => (frame: { x: number; y: number; w: number; h: number }) => {
      const topLeft = editor.pageToViewport({ x: frame.x, y: frame.y });
      const bottomRight = editor.pageToViewport({
        x: frame.x + frame.w,
        y: frame.y + frame.h,
      });

      return {
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      };
    },
    [editor]
  );

  useEffect(() => {
    onSelectedShapeIdsChange(selectedShapeIds);
  }, [onSelectedShapeIdsChange, selectedShapeIds]);

  useEffect(() => {
    onSelectedCanvasCardIdsChange(selectedCardIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire when the actual card IDs change, not on every cards object update
  }, [onSelectedCanvasCardIdsChange, selectedCardIdsKey]);

  useEffect(() => {
    if (
      typeof editor.getCameraOptions !== 'function' ||
      typeof editor.setCameraOptions !== 'function'
    ) {
      return;
    }

    const cameraOptions = editor.getCameraOptions();

    if (areZoomStepsEqual(cameraOptions.zoomSteps, VISUGEN_ZOOM_STEPS)) {
      return;
    }

    editor.setCameraOptions({
      ...cameraOptions,
      zoomSteps: VISUGEN_ZOOM_STEPS,
    });
  }, [editor]);

  const activeDraftCard = useMemo(() => {
    const activeCard = activeComposerCardId
      ? cards[activeComposerCardId]
      : null;
    return isDraftCard(activeCard) ? activeCard : null;
  }, [activeComposerCardId, cards]);
  const activeDraftFrame = useCanvasEngineValue(
    (currentEditor) => {
      if (!activeDraftCard) return null;

      const bounds = currentEditor.getShapePageBounds(
        activeDraftCard.id
      );
      return bounds
        ? { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }
        : null;
    },
    [
      activeDraftCard?.id,
      activeDraftCard?.type,
      activeDraftCard?.aspectRatio,
    ]
  );
  const canvasViewportWidth = useCanvasEngineValue(
    (currentEditor) => {
      try {
        return currentEditor.getContainer().clientWidth;
      } catch {
        return 0;
      }
    }
  );
  const activeDraftComposerPosition = useMemo(() => {
    if (!activeDraftFrame || canvasViewportWidth <= 0) {
      return null;
    }

    return resolveAnchoredComposerPosition({
      frame: frameToViewportRect(activeDraftFrame),
      viewportWidth: canvasViewportWidth,
    });
  }, [
    activeDraftFrame,
    camera,
    canvasViewportWidth,
    frameToViewportRect,
  ]);

  useEffect(() => {
    if (!activeDraftCard || !activeDraftFrame) {
      return;
    }

    const expectedAspectRatio = resolveExplicitAspectRatio(
      activeDraftCard.aspectRatio
    );
    if (
      expectedAspectRatio &&
      Math.abs(activeDraftFrame.w / activeDraftFrame.h - expectedAspectRatio) >
        0.02
    ) {
      return;
    }

    const signature = [
      activeDraftCard.id,
      activeDraftCard.type,
      activeDraftCard.aspectRatio,
    ].join('::');
    if (lastComposerFocusSignatureRef.current === signature) {
      return;
    }

    let focusFrameId: number | null = null;
    const syncFrameId = window.requestAnimationFrame(() => {
      focusFrameId = window.requestAnimationFrame(() => {
        const composer = composerRef.current;
        const frontLayer = frontLayerRef.current;
        if (!composer || !frontLayer) return;
        if (lastComposerFocusSignatureRef.current === signature) return;
        lastComposerFocusSignatureRef.current = signature;

        const currentZoom = editor.getZoomLevel();
        const focusLayout = resolveComposerFocusLayout({
          frameHeight: activeDraftFrame.h,
          viewportHeight: frontLayer.clientHeight,
          composerHeight: composer.offsetHeight,
          currentZoom,
          zoomSteps: VISUGEN_ZOOM_STEPS,
        });

        editor.centerOnPoint(
          {
            x: activeDraftFrame.x + activeDraftFrame.w / 2,
            y:
              activeDraftFrame.y +
              activeDraftFrame.h / 2 +
              focusLayout.verticalPageOffset,
          },
          {
            zoom: focusLayout.zoom,
            animation: { duration: 180 },
          }
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(syncFrameId);
      if (focusFrameId !== null) {
        window.cancelAnimationFrame(focusFrameId);
      }
    };
  }, [
    activeDraftFrame,
    composerPresentation,
    editor,
    activeDraftCard,
  ]);

  const modelOptions =
    activeDraftCard?.type === 'image' ? imageModels : videoModels;
  const selectedModel =
    findWorkspaceModelOption(modelOptions, activeDraftCard?.modelId) ??
    modelOptions[0] ??
    null;
  const selectedModelLabel = selectedModel?.name ?? labels.modelLabel;
  const selectedModeOptions = selectedModel?.modeOptions ?? [];
  const selectedVariantOptions = selectedModel?.variantOptions ?? [];
  const selectedQualityOptions = selectedModel?.qualityOptions ?? [];
  const selectedDurationOptions =
    activeDraftCard?.type === 'video'
      ? (selectedModel?.supportedDurations ?? [])
      : [];
  const selectedLanguageOptions = selectedModel?.supportedLanguages ?? [];
  const selectedAspectRatioOptions = selectedModel?.supportedAspectRatios ?? [];
  const selectedOutputQualities = selectedModel?.supportedOutputQualities ?? [];
  const selectedCharacterOrientationOptions =
    selectedModel?.characterOrientationOptions ?? [];
  const selectedBackgroundSourceOptions =
    selectedModel?.backgroundSourceOptions ?? [];
  const isDraftBusy = activeDraftCard
    ? isDraftBusyStatus(activeDraftCard.status)
    : false;
  const promptCharacterCount = countPromptCharacters(promptInputValue);
  const activePromptPlaceholder =
    activeDraftCard?.type === 'video'
      ? labels.videoPromptPlaceholder
      : labels.imagePromptPlaceholder;

  const parameterSummaryTokens = useMemo(() => {
    if (!activeDraftCard) {
      return [];
    }

    const tokens: string[] = [];

    if (selectedOutputQualities.length > 0) {
      tokens.push(activeDraftCard.outputQuality.toUpperCase());
    }
    if (selectedAspectRatioOptions.length > 0) {
      tokens.push(
        normalizeComposerToken(activeDraftCard.aspectRatio, labels)
      );
    }
    if (selectedDurationOptions.length > 0) {
      tokens.push(activeDraftCard.duration);
    }
    if (
      selectedCharacterOrientationOptions.length > 0 &&
      activeDraftCard.characterOrientation
    ) {
      tokens.push(
        normalizeComposerToken(activeDraftCard.characterOrientation, labels)
      );
    }
    if (
      selectedBackgroundSourceOptions.length > 0 &&
      activeDraftCard.backgroundSource
    ) {
      tokens.push(
        normalizeComposerToken(activeDraftCard.backgroundSource, labels)
      );
    }
    if (selectedLanguageOptions.length > 0 && activeDraftCard.language) {
      tokens.push(
        normalizeComposerToken(activeDraftCard.language, labels)
      );
    }
    if (selectedModeOptions.length > 1) {
      tokens.push(normalizeComposerToken(activeDraftCard.mode, labels));
    }
    if (selectedVariantOptions.length > 1) {
      tokens.push(
        normalizeComposerToken(activeDraftCard.variant, labels)
      );
    }
    if (selectedQualityOptions.length > 1) {
      tokens.push(
        normalizeComposerToken(activeDraftCard.quality, labels)
      );
    }

    return tokens;
  }, [
    labels,
    selectedAspectRatioOptions,
    selectedBackgroundSourceOptions,
    selectedCharacterOrientationOptions,
    selectedDurationOptions,
    selectedLanguageOptions,
    selectedModeOptions,
    selectedOutputQualities,
    selectedQualityOptions,
    selectedVariantOptions,
    activeDraftCard,
  ]);

  const hiddenParameterTokenCount = Math.max(
    parameterSummaryTokens.length - 3,
    0
  );
  const parameterSummaryLabel = useMemo(() => {
    if (parameterSummaryTokens.length === 0) {
      return labels.defaultSetupLabel;
    }

    const visibleTokens = parameterSummaryTokens.slice(0, 3);
    return `${visibleTokens.join(' · ')}${
      hiddenParameterTokenCount > 0 ? ` +${hiddenParameterTokenCount}` : ''
    }`;
  }, [
    hiddenParameterTokenCount,
    labels.defaultSetupLabel,
    parameterSummaryTokens,
  ]);
  const visibleParameterSummaryTokens = useMemo(
    () =>
      parameterSummaryTokens.length > 0
        ? parameterSummaryTokens.slice(0, 3)
        : [labels.defaultSetupLabel],
    [labels.defaultSetupLabel, parameterSummaryTokens]
  );

  const referencePickerOptions = useMemo(
    () =>
      activeDraftCard
        ? getDraftReferencePickerOptions({
            draftCard: activeDraftCard,
            cards,
            model: selectedModel,
          })
        : [],
    [cards, selectedModel, activeDraftCard]
  );
  const primaryReferenceIntent =
    referencePickerOptions[0]?.intent ??
    activeDraftCard?.type ??
    'image';
  const currentReferenceCards = useMemo(() => {
    if (!activeDraftCard) {
      return [];
    }

    const mentions = buildCanvasReferenceMentions({
      referenceCardIds: activeDraftCard.referenceCardIds,
      cards,
    });

    return mentions.map((mention) => ({
      id: mention.cardId,
      name: mention.name,
      type: mention.type,
      alias: mention.alias,
      thumbnailUrl: cards[mention.cardId]?.url ?? null,
    }));
  }, [activeDraftCard, cards]);
  const promptReferences = useMemo(
    () =>
      currentReferenceCards.map((card) => ({
        cardId: card.id,
        type: card.type,
        index: Number.parseInt(card.alias.replace(/\D/g, ''), 10),
        alias: card.alias,
        name: card.name,
        thumbnailUrl: card.thumbnailUrl,
      })),
    [currentReferenceCards]
  );
  const canvasReferenceCards = useMemo(() => {
    if (!activeDraftCard) {
      return [];
    }

    return listCompatibleCanvasReferenceCards({
      draftCard: activeDraftCard,
      cards,
      model: selectedModel,
    }).map((card) => ({
      id: card.id,
      name: card.name,
      type: card.type,
      thumbnailUrl: card.url,
    }));
  }, [activeDraftCard, cards, selectedModel]);
  const generationOutputs = useMemo(
    () =>
      activeDraftCard
        ? listGenerationOutputsForDraft(cards, activeDraftCard.id)
        : [],
    [activeDraftCard, cards]
  );
  const pinnedOutputId = useMemo(
    () =>
      resolvePinnedGenerationOutputId({
        outputs: generationOutputs,
        pinnedOutputId: activeDraftCard?.pinnedOutputId,
      }),
    [activeDraftCard?.pinnedOutputId, generationOutputs]
  );

  const truncatePrompt = (value: string) =>
    truncatePromptToMaxChars(value, promptCharacterLimit);

  const handlePromptValueChange = (nextPrompt: string) => {
    if (!activeDraftCard || isDraftBusy) {
      return;
    }

    setPromptInputValue(nextPrompt);

    if (isPromptComposing) {
      return;
    }

    onDraftPromptChange(activeDraftCard.id, truncatePrompt(nextPrompt));
  };

  const handlePromptCommit = (nextPrompt: string) => {
    if (!activeDraftCard || isDraftBusy) {
      return;
    }

    const truncatedPrompt = truncatePrompt(nextPrompt);
    setPromptInputValue(truncatedPrompt);
    onDraftPromptChange(activeDraftCard.id, truncatedPrompt);
  };

  useEffect(() => {
    setIsTypeSelectOpen(false);
    setIsModelSelectOpen(false);
    setIsParameterPopoverOpen(false);
    setIsReferencePickerOpen(false);
    setIsVersionPickerOpen(false);
  }, [activeDraftCard?.id]);

  useEffect(() => {
    if (
      !isTypeSelectOpen &&
      !isModelSelectOpen &&
      !isParameterPopoverOpen &&
      !isReferencePickerOpen &&
      !isVersionPickerOpen
    ) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const nextPopoverState = resolveComposerPopoverStateOnPointerDown({
        isTypeSelectOpen,
        isModelSelectOpen,
        isParameterPopoverOpen,
        isReferencePickerOpen,
        isVersionPickerOpen,
        isWithinComposer: Boolean(composerRef.current?.contains(target)),
        isWithinTypePicker: Boolean(typePickerRef.current?.contains(target)),
        isWithinModelPicker: Boolean(modelPickerRef.current?.contains(target)),
        isWithinParameterPicker: Boolean(
          parameterPickerRef.current?.contains(target)
        ),
        isWithinReferencePicker: Boolean(
          referencePickerRef.current?.contains(target)
        ),
        isWithinVersionPicker: Boolean(
          versionPickerRef.current?.contains(target)
        ),
      });

      setIsTypeSelectOpen(nextPopoverState.isTypeSelectOpen);
      setIsModelSelectOpen(nextPopoverState.isModelSelectOpen);
      setIsParameterPopoverOpen(nextPopoverState.isParameterPopoverOpen);
      setIsReferencePickerOpen(nextPopoverState.isReferencePickerOpen);
      setIsVersionPickerOpen(nextPopoverState.isVersionPickerOpen);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [
    isModelSelectOpen,
    isParameterPopoverOpen,
    isReferencePickerOpen,
    isTypeSelectOpen,
    isVersionPickerOpen,
  ]);

  useEffect(() => {
    if (!activeDraftCard) {
      setPromptInputValue('');
      setIsPromptComposing(false);
      return;
    }

    if (isPromptComposing) {
      return;
    }

    setPromptInputValue(activeDraftCard.prompt);
  }, [isPromptComposing, activeDraftCard]);

  useEffect(() => {
    if (!isDraftBusy) {
      return;
    }

    setIsTypeSelectOpen(false);
    setIsModelSelectOpen(false);
    setIsParameterPopoverOpen(false);
    setIsReferencePickerOpen(false);
    setIsVersionPickerOpen(false);
  }, [isDraftBusy]);

  return (
    <div
      ref={frontLayerRef}
      className="pointer-events-none absolute inset-0 z-30"
    >
      <div
        className={cn(
          'pointer-events-auto absolute left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1 rounded-[var(--beat-radius-sm)] px-1.5 py-1',
          activeComposerCardId ? 'top-4' : 'bottom-4',
          beatcanvasPanelClassName
        )}
      >
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-xl transition duration-150',
            activeCanvasTool === 'select'
              ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-[var(--beat-text-2)] hover:bg-white/[0.06] hover:text-white'
          )}
          onClick={() => {
            setActiveCanvasTool('select');
            editor.setCurrentTool('select');
          }}
          aria-label={labels.selectToolLabel}
          aria-pressed={activeCanvasTool === 'select'}
        >
          <MousePointer2 className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-xl transition duration-150',
            activeCanvasTool === 'pan'
              ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-[var(--beat-text-2)] hover:bg-white/[0.06] hover:text-white'
          )}
          onClick={() => {
            setActiveCanvasTool('pan');
            editor.setCurrentTool('pan');
          }}
          aria-label={labels.panToolLabel}
          aria-pressed={activeCanvasTool === 'pan'}
        >
          <Hand className="size-3.5" />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-xl text-[var(--beat-text-2)] transition duration-150 hover:bg-white/[0.06] hover:text-white"
          onClick={() => {
            if (typeof editor.zoomOut === 'function') {
              editor.zoomOut(undefined, { animation: { duration: 180 } });
            }
          }}
          aria-label={labels.zoomOutLabel}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex h-8 min-w-[54px] items-center justify-center rounded-xl bg-white/[0.05] px-2 text-[12px] font-medium tabular-nums text-[var(--beat-text-2)] transition duration-150 hover:text-white"
          onClick={() => {
            if (typeof editor.resetZoom === 'function') {
              editor.resetZoom(undefined, { animation: { duration: 180 } });
            }
          }}
        >
          {zoomLevel}%
        </button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-xl text-[var(--beat-text-2)] transition duration-150 hover:bg-white/[0.06] hover:text-white"
          onClick={() => {
            if (typeof editor.zoomIn === 'function') {
              editor.zoomIn(undefined, { animation: { duration: 180 } });
            }
          }}
          aria-label={labels.zoomInLabel}
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-xl text-[var(--beat-text-2)] transition duration-150 hover:bg-white/[0.06] hover:text-white"
          onClick={() => editor.fitView({ animation: { duration: 220 } })}
          aria-label={labels.fitViewLabel}
        >
          <Focus className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-xl transition duration-150 hover:bg-white/[0.06] hover:text-white',
            edgesVisible
              ? 'text-[var(--beat-text-2)]'
              : 'bg-[var(--beat-graph-soft)] text-[var(--beat-graph)]'
          )}
          onClick={() => {
            const next = !edgesVisible;
            setEdgesVisible(next);
            editor.setEdgesVisible(next);
          }}
          aria-label={
            edgesVisible ? labels.hideEdgesLabel : labels.showEdgesLabel
          }
          aria-pressed={!edgesVisible}
        >
          <EyeOff className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-xl transition duration-150 hover:bg-white/[0.06] hover:text-white',
            isSnapToGridActive
              ? 'bg-[var(--beat-graph-soft)] text-[var(--beat-graph)]'
              : 'text-[var(--beat-text-2)]'
          )}
          onClick={() => {
            const next = !isSnapToGridActive;
            setIsSnapToGridActive(next);
            editor.setSnapToGrid(next);
          }}
          aria-label={labels.snapToGridLabel}
          aria-pressed={isSnapToGridActive}
        >
          <Magnet className="size-3.5" />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          disabled={!canUndoCanvas}
          onClick={onUndoCanvas}
          className="inline-flex size-8 items-center justify-center rounded-xl text-[var(--beat-text-2)] transition duration-150 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:text-white/25"
          aria-label={labels.undoLabel}
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={!canRedoCanvas}
          onClick={onRedoCanvas}
          className="inline-flex size-8 items-center justify-center rounded-xl text-[var(--beat-text-2)] transition duration-150 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:text-white/25"
          aria-label={labels.redoLabel}
        >
          <Redo2 className="size-3.5" />
        </button>
      </div>

      {Object.keys(cards).length === 0 ? (
        <div className="absolute inset-x-0 top-[46%] z-10 flex -translate-y-1/2 justify-center px-6">
          <StudioStartHere />
        </div>
      ) : null}

      {activeDraftCard ? (
        <BeatCanvasComposerShell
          activeDraftCard={activeDraftCard}
          composerRef={composerRef}
          isDraftBusy={isDraftBusy}
          isPromptComposing={isPromptComposing}
          labels={labels}
          onActiveComposerCardIdChange={onActiveComposerCardIdChange}
          onGenerateDraft={onGenerateDraft}
          onPromptChange={handlePromptValueChange}
          onPromptCommit={handlePromptCommit}
          onPromptCompositionChange={setIsPromptComposing}
          promptCharacterCount={promptCharacterCount}
          promptCharacterLimit={promptCharacterLimit}
          promptInputValue={promptInputValue}
          promptPlaceholder={activePromptPlaceholder}
          promptReferences={promptReferences}
          presentation={composerPresentation}
          position={activeDraftComposerPosition}
          takeCount={generationOutputs.length}
          promptAccessory={(insertReferenceMention) => (
            <>
              <BeatCanvasComposerReferencePicker
                activeDraftId={activeDraftCard.id}
                canvasReferenceCards={canvasReferenceCards}
                containerRef={referencePickerRef}
                currentReferenceCards={currentReferenceCards}
                isDraftBusy={isDraftBusy}
                isOpen={isReferencePickerOpen}
                labels={labels}
                onAttachCanvasReference={onAttachCanvasReference}
                onOpenChange={(nextOpen) => {
                  setIsTypeSelectOpen(false);
                  setIsModelSelectOpen(false);
                  setIsParameterPopoverOpen(false);
                  setIsVersionPickerOpen(false);
                  setIsReferencePickerOpen(nextOpen);
                }}
                onOpenReferencePicker={onOpenReferencePicker}
                onInsertReferenceMention={insertReferenceMention}
                onReorderCanvasReferences={onReorderCanvasReferences}
                onRemoveCanvasReference={onDetachCanvasReference}
                options={referencePickerOptions}
                primaryIntent={primaryReferenceIntent}
                variant="row"
              />
              <BeatCanvasComposerVersionPicker
                activeDraftId={activeDraftCard.id}
                containerRef={versionPickerRef}
                isDraftBusy={isDraftBusy}
                isOpen={isVersionPickerOpen}
                labels={labels}
                onOpenChange={(nextOpen) => {
                  setIsTypeSelectOpen(false);
                  setIsModelSelectOpen(false);
                  setIsParameterPopoverOpen(false);
                  setIsReferencePickerOpen(false);
                  setIsVersionPickerOpen(nextOpen);
                }}
                onPinGenerationOutput={onPinGenerationOutput}
                outputs={generationOutputs}
                pinnedOutputId={pinnedOutputId}
              />
            </>
          )}
        >
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
            <BeatCanvasComposerTypePicker
              activeDraftId={activeDraftCard.id}
              containerRef={typePickerRef}
              isDraftBusy={isDraftBusy}
              isOpen={isTypeSelectOpen}
              labels={labels}
              onDraftTaskTypeChange={onDraftTaskTypeChange}
              onOpenChange={(nextOpen) => {
                setIsModelSelectOpen(false);
                setIsParameterPopoverOpen(false);
                setIsReferencePickerOpen(false);
                setIsVersionPickerOpen(false);
                setIsTypeSelectOpen(nextOpen);
              }}
              selectedType={activeDraftCard.type}
            />

            <div className="contents">
                <BeatCanvasComposerModelPicker
                  activeDraftId={activeDraftCard.id}
                  containerRef={modelPickerRef}
                  isDraftBusy={isDraftBusy}
                  isOpen={isModelSelectOpen}
                  modelOptions={modelOptions}
                  onDraftModelChange={onDraftModelChange}
                  onOpenChange={(nextOpen) => {
                    setIsTypeSelectOpen(false);
                    setIsReferencePickerOpen(false);
                    setIsParameterPopoverOpen(false);
                    setIsVersionPickerOpen(false);
                    setIsModelSelectOpen(nextOpen);
                  }}
                  selectedModelId={
                    selectedModel?.id ?? activeDraftCard.modelId
                  }
                  selectedModelLabel={selectedModelLabel}
                />
              </div>

              <div className="contents">
                <BeatCanvasComposerParameterPicker
                  activeDraftCard={activeDraftCard}
                  containerRef={parameterPickerRef}
                  isDraftBusy={isDraftBusy}
                  isOpen={isParameterPopoverOpen}
                  labels={labels}
                  onDraftAspectRatioChange={onDraftAspectRatioChange}
                  onDraftBackgroundSourceChange={onDraftBackgroundSourceChange}
                  onDraftCharacterOrientationChange={
                    onDraftCharacterOrientationChange
                  }
                  onDraftDurationChange={onDraftDurationChange}
                  onDraftLanguageChange={onDraftLanguageChange}
                  onDraftModeChange={onDraftModeChange}
                  onDraftOutputQualityChange={onDraftOutputQualityChange}
                  onDraftQualityChange={onDraftQualityChange}
                  onDraftVariantChange={onDraftVariantChange}
                  onOpenChange={(nextOpen) => {
                    setIsTypeSelectOpen(false);
                    setIsReferencePickerOpen(false);
                    setIsModelSelectOpen(false);
                    setIsVersionPickerOpen(false);
                    setIsParameterPopoverOpen(nextOpen);
                  }}
                  parameterSummaryLabel={parameterSummaryLabel}
                  selectedAspectRatioOptions={selectedAspectRatioOptions}
                  selectedBackgroundSourceOptions={
                    selectedBackgroundSourceOptions
                  }
                  selectedCharacterOrientationOptions={
                    selectedCharacterOrientationOptions
                  }
                  selectedDurationOptions={selectedDurationOptions}
                  selectedLanguageOptions={selectedLanguageOptions}
                  selectedModeOptions={selectedModeOptions}
                  selectedOutputQualities={selectedOutputQualities}
                  selectedQualityOptions={selectedQualityOptions}
                  selectedVariantOptions={selectedVariantOptions}
                  visibleParameterSummaryTokens={visibleParameterSummaryTokens}
                />
              </div>
            </div>
        </BeatCanvasComposerShell>
      ) : null}

      <CardConnectorOverlay />
    </div>
  );
}
