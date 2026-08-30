'use client';


import {
  invalidateWorkspaceAfterAssetMutation,
  invalidateWorkspaceAfterGeneration,
} from '@/core/workspace-lib/app/workspace-query-invalidation';
import { generationValidationConstraints } from '@/core/effects/validation';
import {
  type WorkspaceModelOption,
  getCanonicalWorkspaceModelId,
  getDefaultSelectableWorkspaceModel,
  getWorkspaceModelsByType,
} from '@/core/effects/workspace-models';
import type { ProjectSnapshotActiveTemplateWorkflow } from '@/core/projects/project-snapshot';
import type {
  CanvasCard,
  CanvasCardMediaType,
  CanvasDraftCard,
} from '@/core/beatcanvas/canvas-types';
import {
  appendUniqueReferenceCardId,
  canUseCanvasCardAsGenerationReference,
  removeReferenceCardId,
  shouldIgnoreCanvasModifierShortcut,
  shouldIgnoreCanvasShortcut,
} from '@/core/beatcanvas/composer';
import {
  buildCanvasReferenceMentions,
  moveCanvasReferenceCardId,
  rewriteCanvasReferenceAliases,
} from '@/core/beatcanvas/reference-mentions';
import { getSelectableModel } from '@/core/beatcanvas/generation-controller';
import { resolveConcreteCanvasMediaCard } from '@/core/beatcanvas/generation-history';
import {
  PROJECT_ASSET_DRAG_MIME,
  PROJECT_ASSET_INSERT_EVENT,
  getProjectAssetCardSize,
  isProjectAssetTransferType,
  parseProjectAssetTransfer,
  type ProjectAssetInsertDetail,
  type ProjectAssetTransfer,
} from '@/core/beatcanvas/project-asset-transfer';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  addProjectAssetsToTimeline,
} from '@/core/editor/timeline-client';
import { extractVideoFrame } from '@/core/media/video-frame';
import { uploadLocalProjectAsset } from '@/core/workspace-lib/app/local-project-asset-client';
import { useCanvasComposerLabels } from './use-canvas-composer-labels';
import { useProjectSnapshotLifecycle } from './use-project-snapshot-lifecycle';
import { useBeatCanvasGraph } from './use-beatcanvas-graph';
import { useBeatCanvasDraftActions } from './use-beatcanvas-draft-actions';
import { useBeatCanvasGenerationRuntime } from './use-beatcanvas-generation-runtime';
import {
  type UploadIntent,
  useBeatCanvasUploadActions,
} from './use-beatcanvas-upload-actions';
import {
  BeatCanvasFrontLayerProvider,
  type BeatCanvasFrontLayerValue,
} from './beatcanvas-front-layer-context';
import { registerCardConnectorCallback } from './beatcanvas-card-connector-bridge';
import type { BeatCanvasPreviewMedia } from './beatcanvas-media-preview-overlay';
import {
  getPreviewableCanvasCardFromSelection,
  isDownloadableCanvasCard,
  resolveBatchCanvasCardSelection,
} from './beatcanvas-media-preview';
import BeatCanvasSidebar from './beatcanvas-sidebar';
import { BeatCanvasLoading } from './beatcanvas-loading';

/**
 * Lazy-load heavy conditional overlays so they don't inflate the initial
 * canvas bundle. These are only rendered when the user opens them.
 */
const BeatCanvasContextToolbar = lazy(() =>
  import('./beatcanvas-context-toolbar').then((mod) => ({
    default: mod.BeatCanvasContextToolbar,
  }))
);
const BeatCanvasMediaPreviewOverlay = lazy(() =>
  import('./beatcanvas-media-preview-overlay').then((mod) => ({
    default: mod.BeatCanvasMediaPreviewOverlay,
  }))
);
const BeatCanvasStatusPill = lazy(() =>
  import('./beatcanvas-status-pill').then((mod) => ({
    default: mod.BeatCanvasStatusPill,
  }))
);

/**
 * Keep the canvas interaction layer lazy so the main studio shell remains
 * small while React Flow and the composer overlays load together.
 */
const BeatCanvasFrontLayer = lazy(() =>
  import('./beatcanvas-front-layer').then(
    (mod) => ({ default: mod.BeatCanvasFrontLayer })
  )
);

const BeatCanvasReactFlowEditor = lazy(
  () => import('@/components/beatcanvas/react-flow/react-flow-editor')
);

const getInitialTaskType = ({
  initialTarget,
  initialModelId,
  imageModels,
}: {
  initialTarget: string | null;
  initialModelId: string | null;
  imageModels: WorkspaceModelOption[];
}): CanvasCardMediaType => {
  if (initialTarget === 'image') return 'image';

  if (!initialModelId) return 'video';

  const canonicalModelId = getCanonicalWorkspaceModelId(initialModelId);
  return imageModels.some((item) => item.id === canonicalModelId)
    ? 'image'
    : 'video';
};

const getCanvasShortcutTargetContext = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return {
      tagName: null,
      isContentEditable: false,
    };
  }

  const interactiveAncestor = target.closest(
    'input, textarea, select, button, a, [contenteditable="true"], [contenteditable="plaintext-only"]'
  );
  const resolvedTarget = interactiveAncestor ?? target;

  return {
    tagName: resolvedTarget.tagName,
    isContentEditable:
      resolvedTarget instanceof HTMLElement
        ? resolvedTarget.isContentEditable
        : false,
  };
};

const sanitizeDownloadName = (value: string) =>
  Array.from(value.trim().replace(/[<>:"/\\|?*]+/g, '-'))
    .filter((character) => character >= ' ')
    .join('')
    .replace(/\s+/g, '-')
    .toLowerCase();

export function BeatCanvasShell({
  projectId,
  projectPath,
  initialProjectSnapshot,
  initialProjectSnapshotVersion,
  initialTarget,
  initialModelId,
  initialPrompt,
}: {
  projectId: string;
  projectPath: string;
  initialProjectSnapshot:
    | import('@/core/projects/project-snapshot').ProjectSnapshotDocument
    | null;
  initialProjectSnapshotVersion: number | null;
  initialTarget: string | null;
  initialModelId: string | null;
  initialPrompt: string | null;
}) {
  const rawStudioT = useTranslations('AppShell.studio');
  const projectAssetsT = useTranslations('AppShell.header.projectAssets');
  const queryClient = useQueryClient();
  const refreshWorkspaceAfterGeneration = useCallback(() => {
    void invalidateWorkspaceAfterGeneration(queryClient);
  }, [queryClient]);
  const refreshWorkspaceAfterUpload = useCallback(() => {
    void invalidateWorkspaceAfterAssetMutation(queryClient);
  }, [queryClient]);
  const studioT = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      rawStudioT(key as never, values as never),
    [rawStudioT]
  );

  const imageModels = useMemo(
    () =>
      getWorkspaceModelsByType('ai-image').filter(
        (item) => item.available !== false
      ),
    []
  );
  const videoModels = useMemo(
    () =>
      getWorkspaceModelsByType('ai-video').filter(
        (item) => item.available !== false
      ),
    []
  );
  const canonicalInitialModelId = initialModelId
    ? getCanonicalWorkspaceModelId(initialModelId)
    : null;
  const initialTaskType = getInitialTaskType({
    initialTarget,
    initialModelId,
    imageModels,
  });
  const initialImageModel = getSelectableModel(
    imageModels,
    canonicalInitialModelId ??
      getDefaultSelectableWorkspaceModel('ai-image')?.id
  );
  const initialVideoModel = getSelectableModel(
    videoModels,
    canonicalInitialModelId
  );

  const {
    activeComposerCardId,
    canvasCards,
    canvasCardsRef,
    copySelectedCanvasCards,
    createConnectorBetweenCards,
    createDraftCard,
    buildProjectSnapshotDocument: buildCanvasProjectSnapshotDocument,
    canUndoCanvas,
    canRedoCanvas,
    recordCanvasHistory,
    undoCanvas,
    redoCanvas,
    editorRef,
    focusShape,
    focusShapes,
    handleSelectedShapeIdsChange,
    handleSelectShape,
    handleSelectedCanvasCardIdsChange,
    insertAssetCard,
    pasteCanvasCards,
    createGenerationOutput,
    updateGenerationOutput,
    completeGenerationOutput,
    removeConnectorBetweenCards,
    removeCanvasCardsForShapes,
    restoreProjectSnapshot: restoreCanvasProjectSnapshot,
    selectedShapeIds,
    selectedCanvasCardIds,
    setActiveComposerCardId,
    updateCanvasCard,
    updateDraftCard,
  } = useBeatCanvasGraph({
    studioT,
    imageModels,
    videoModels,
    initialImageModelId: initialImageModel?.id ?? null,
    initialVideoModelId: initialVideoModel?.id ?? null,
  });

  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [canvasDocumentRevision, setCanvasDocumentRevision] = useState(0);
  const [allowEmptyProjectSnapshot, setAllowEmptyProjectSnapshot] =
    useState(false);
  const [previewMedia, setPreviewMedia] = useState<BeatCanvasPreviewMedia | null>(
    null
  );
  const [isContinuingVideo, setIsContinuingVideo] = useState(false);
  const [isAddingSelectionToTimeline, setIsAddingSelectionToTimeline] =
    useState(false);

  const insertProjectAsset = useCallback(
    (
      asset: ProjectAssetTransfer,
      clientPoint?: { x: number; y: number }
    ) => {
      if (asset.projectId !== projectId) return;

      const size = getProjectAssetCardSize(asset);
      const pagePoint = clientPoint
        ? editorRef.current?.screenToPage(clientPoint)
        : null;
      const insertedShapeId = insertAssetCard({
        assetId: asset.id,
        type: asset.mediaType,
        url: asset.publicUrl,
        name:
          asset.filename?.trim() ||
          projectAssetsT(
            asset.mediaType === 'image'
              ? 'imageName'
              : asset.mediaType === 'audio'
                ? 'audioName'
                : 'videoName'
          ),
        kind: 'asset',
        activateOnInsert: true,
        size,
        durationSec:
          typeof asset.durationMs === 'number' ? asset.durationMs / 1000 : null,
        audioRole: asset.mediaType === 'audio' ? 'music' : undefined,
        ...(pagePoint
          ? {
              frame: {
                x: pagePoint.x - size.w / 2,
                y: pagePoint.y - size.h / 2,
                w: size.w,
                h: size.h,
              },
            }
          : {}),
      });

      if (insertedShapeId) {
        toast.success(projectAssetsT('addedToCanvas'));
      }
    },
    [editorRef, insertAssetCard, projectAssetsT, projectId]
  );

  useEffect(() => {
    const handleInsertEvent = (event: Event) => {
      const detail = (event as CustomEvent<ProjectAssetInsertDetail>).detail;
      if (!detail?.asset) return;
      insertProjectAsset(detail.asset, detail.clientPoint);
    };

    const handleDragOver = (event: DragEvent) => {
      if (
        !event.dataTransfer ||
        !isProjectAssetTransferType(Array.from(event.dataTransfer.types))
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event: DragEvent) => {
      const transferValue = event.dataTransfer?.getData(
        PROJECT_ASSET_DRAG_MIME
      );
      if (!transferValue) return;

      const asset = parseProjectAssetTransfer(transferValue);
      if (!asset || asset.projectId !== projectId) return;

      event.preventDefault();
      event.stopPropagation();
      insertProjectAsset(asset, { x: event.clientX, y: event.clientY });
    };

    window.addEventListener(PROJECT_ASSET_INSERT_EVENT, handleInsertEvent);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('drop', handleDrop, true);
    return () => {
      window.removeEventListener(PROJECT_ASSET_INSERT_EVENT, handleInsertEvent);
      window.removeEventListener('dragover', handleDragOver, true);
      window.removeEventListener('drop', handleDrop, true);
    };
  }, [insertProjectAsset, projectId]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setErrorMessage(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [errorMessage]);

  const {
    handleMediaUpload,
    handleUpload,
    mediaFileInputRef,
    imageFileInputRef,
    getPendingUploadCountForDraft,
    openMediaUploadPicker,
    openUploadPicker,
    promotePendingUploadsForDraft,
    uploadFiles,
    uploadIntent,
    videoFileInputRef,
  } = useBeatCanvasUploadActions({
    projectId,
    studioT,
    imageModels,
    videoModels,
    canvasCardsRef,
    setErrorMessage,
    setStatusMessage,
    createConnectorBetweenCards,
    createDraftCard,
    focusShape,
    focusShapes,
    handleSelectShape,
    insertAssetCard,
    updateCanvasCard,
    updateDraftCard,
    setActiveComposerCardId,
    onWorkspaceAssetsMayChange: refreshWorkspaceAfterUpload,
  });

  useEffect(() => {
    const handleLocalFileDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };

    const handleLocalFileDrop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void uploadFiles({ intent: 'media', mode: 'global' }, files);
    };

    window.addEventListener('dragover', handleLocalFileDragOver, true);
    window.addEventListener('drop', handleLocalFileDrop, true);
    return () => {
      window.removeEventListener('dragover', handleLocalFileDragOver, true);
      window.removeEventListener('drop', handleLocalFileDrop, true);
    };
  }, [uploadFiles]);

  const {
    handleCreatePromptDraft,
    handleDraftAnalysisDepthChange,
    handleDraftAspectRatioChange,
    handleDraftBackgroundSourceChange,
    handleDraftCharacterOrientationChange,
    handleDraftDurationChange,
    handleDraftLanguageChange,
    handleDraftModeChange,
    handleDraftModelChange,
    handleDraftOutputQualityChange,
    handleDraftPromptChange,
    handleDraftQualityChange,
    handleDraftTaskTypeChange,
    handleDraftVariantChange,
  } = useBeatCanvasDraftActions({
    canvasCardsRef,
    selectedCanvasCardIds,
    imageModels,
    videoModels,
    initialImageModelId: initialImageModel?.id ?? null,
    initialVideoModelId: initialVideoModel?.id ?? null,
    studioT,
    createDraftCard,
    setActiveComposerCardId,
    updateDraftCard,
  });

  const {
    handleGenerateDraft,
    metadataMap,
    resumeInFlightGenerations,
    runGenerateDraft,
  } = useBeatCanvasGenerationRuntime({
      projectId,
      studioT,
      canvasCardsRef,
      imageModels,
      isCanvasReady,
      videoModels,
      getPendingUploadCountForDraft,
      promotePendingUploadsForDraft,
      createGenerationOutput,
      updateGenerationOutput,
      completeGenerationOutput,
      setErrorMessage,
      setStatusMessage,
      updateDraftCard,
      onGenerationComplete: refreshWorkspaceAfterGeneration,
    });

  const handleCreateGenerationFromConnector = useCallback(
    ({
      sourceCardId,
      taskType,
      pagePoint,
    }: {
      sourceCardId: string;
      taskType: CanvasCardMediaType;
      pagePoint: { x: number; y: number };
    }) => {
      const sourceCard = canvasCardsRef.current[sourceCardId];
      if (!sourceCard) {
        return;
      }

      const models = taskType === 'image' ? imageModels : videoModels;
      const targetModel = getSelectableModel(models, null);
      if (
        !canUseCanvasCardAsGenerationReference({
          sourceCard,
          targetType: taskType,
          targetModel,
        })
      ) {
        return;
      }

      createDraftCard({
        taskType,
        prompt: '',
        referenceCardIds: [sourceCardId],
        anchorCardIds: [sourceCardId],
        placementPoint: pagePoint,
      });
    },
    [canvasCardsRef, createDraftCard, imageModels, videoModels]
  );

  const handleCreateGenerationAtPoint = useCallback(
    ({
      taskType,
      pagePoint,
    }: {
      taskType: CanvasCardMediaType;
      pagePoint: { x: number; y: number };
    }) => {
      createDraftCard({
        taskType,
        prompt: '',
        referenceCardIds: [],
        placementPoint: pagePoint,
        connectReferences: false,
      });
    },
    [createDraftCard]
  );

  const handleAttachCanvasReference = useCallback(
    (draftId: string, sourceCardId: string) => {
      const sourceCard = canvasCardsRef.current[sourceCardId];
      const draftCard = canvasCardsRef.current[draftId];
      if (!sourceCard || draftCard?.kind !== 'generation') {
        return;
      }

      if (
        draftCard.generationMode === 'analysis' &&
        !draftCard.referenceCardIds?.includes(sourceCardId) &&
        (draftCard.referenceCardIds?.length ?? 0) >= 1
      ) {
        return;
      }

      const models = draftCard.type === 'image' ? imageModels : videoModels;
      const targetModel = getSelectableModel(models, draftCard.modelId);
      if (
        !canUseCanvasCardAsGenerationReference({
          sourceCard,
          targetType: draftCard.type,
          targetModel,
          targetGenerationMode: draftCard.generationMode,
        })
      ) {
        return;
      }

      createConnectorBetweenCards(sourceCardId, draftId, {
        recordHistory: true,
      });
      updateDraftCard(draftId, {
        referenceCardIds: appendUniqueReferenceCardId(
          draftCard.referenceCardIds,
          sourceCardId
        ),
      });
    },
    [
      canvasCardsRef,
      createConnectorBetweenCards,
      imageModels,
      updateDraftCard,
      videoModels,
    ]
  );

  const handleDetachCanvasReference = useCallback(
    (draftId: string, sourceCardId: string) => {
      const draftCard = canvasCardsRef.current[draftId];
      if (draftCard?.kind !== 'generation') {
        return;
      }

      removeConnectorBetweenCards(sourceCardId, draftId, {
        recordHistory: true,
      });
      updateDraftCard(draftId, (current) => {
        const nextReferenceCardIds = removeReferenceCardId(
          current.referenceCardIds,
          sourceCardId
        );
        const previousMentions = buildCanvasReferenceMentions({
          referenceCardIds: current.referenceCardIds,
          cards: canvasCardsRef.current,
        });
        const nextMentions = buildCanvasReferenceMentions({
          referenceCardIds: nextReferenceCardIds,
          cards: canvasCardsRef.current,
        });

        return {
          ...current,
          prompt: rewriteCanvasReferenceAliases({
            prompt: current.prompt,
            previousMentions,
            nextMentions,
          }),
          referenceCardIds: nextReferenceCardIds,
        };
      });
    },
    [canvasCardsRef, removeConnectorBetweenCards, updateDraftCard]
  );

  const handleReorderCanvasReferences = useCallback(
    (draftId: string, activeCardId: string, overCardId: string) => {
      const draftCard = canvasCardsRef.current[draftId];
      if (draftCard?.kind !== 'generation') return;

      const nextReferenceCardIds = moveCanvasReferenceCardId({
        referenceCardIds: draftCard.referenceCardIds,
        activeCardId,
        overCardId,
      });
      if (nextReferenceCardIds === draftCard.referenceCardIds) return;

      const previousMentions = buildCanvasReferenceMentions({
        referenceCardIds: draftCard.referenceCardIds,
        cards: canvasCardsRef.current,
      });
      const nextMentions = buildCanvasReferenceMentions({
        referenceCardIds: nextReferenceCardIds,
        cards: canvasCardsRef.current,
      });

      recordCanvasHistory();
      updateDraftCard(draftId, {
        prompt: rewriteCanvasReferenceAliases({
          prompt: draftCard.prompt,
          previousMentions,
          nextMentions,
        }),
        referenceCardIds: nextReferenceCardIds,
        status: 'idle',
        error: null,
      });
    },
    [canvasCardsRef, recordCanvasHistory, updateDraftCard]
  );

  const handleReferenceEdgesRemoved = useCallback(
    (edges: Array<{ source: string; target: string }>) => {
      for (const edge of edges) {
        const draftCard = canvasCardsRef.current[edge.target];
        if (draftCard?.kind !== 'generation') {
          continue;
        }

        updateDraftCard(draftCard.id, (current) => {
          const nextReferenceCardIds = removeReferenceCardId(
            current.referenceCardIds,
            edge.source
          );
          return {
            ...current,
            prompt: rewriteCanvasReferenceAliases({
              prompt: current.prompt,
              previousMentions: buildCanvasReferenceMentions({
                referenceCardIds: current.referenceCardIds,
                cards: canvasCardsRef.current,
              }),
              nextMentions: buildCanvasReferenceMentions({
                referenceCardIds: nextReferenceCardIds,
                cards: canvasCardsRef.current,
              }),
            }),
            referenceCardIds: nextReferenceCardIds,
          };
        });
      }
    },
    [canvasCardsRef, updateDraftCard]
  );

  const handlePinGenerationOutput = useCallback(
    (draftId: string, outputId: string) => {
      const draftCard = canvasCardsRef.current[draftId];
      const outputCard = canvasCardsRef.current[outputId];
      if (draftCard?.kind !== 'generation' || outputCard?.kind !== 'output') {
        return;
      }

      recordCanvasHistory();
      updateDraftCard(draftId, {
        pinnedOutputId: outputId,
        url: outputCard.url,
        resultText: outputCard.resultText ?? null,
      });
    },
    [canvasCardsRef, recordCanvasHistory, updateDraftCard]
  );

  const selectedCanvasCards = useMemo(
    () =>
      selectedCanvasCardIds
        .map((cardId) => canvasCards[cardId])
        .filter((card): card is CanvasCard => Boolean(card)),
    [canvasCards, selectedCanvasCardIds]
  );

  const canvasCopy = useCanvasComposerLabels();

  const canvasComponents = useMemo(
    () => ({
      InFrontOfTheCanvas: BeatCanvasFrontLayer,
    }),
    []
  );

  const frontLayerValue = useMemo<BeatCanvasFrontLayerValue>(
    () => ({
      cards: canvasCards,
      selectedShapeIds,
      selectedCanvasCardIds,
      activeComposerCardId,
      composerPresentation: null,
      imageModels,
      videoModels,
      effectMetadataMap: metadataMap,
      labels: canvasCopy,
      promptCharacterLimit: generationValidationConstraints.maxPromptChars,
      canUndoCanvas,
      canRedoCanvas,
      onUndoCanvas: undoCanvas,
      onRedoCanvas: redoCanvas,
      onCreateImageDraft: () => handleCreatePromptDraft('image'),
      onUploadImage: () =>
        openUploadPicker({ intent: 'image', mode: 'global' }),
      onCreateGenerationFromConnector: handleCreateGenerationFromConnector,
      onCreateGenerationAtPoint: handleCreateGenerationAtPoint,
      onSelectedShapeIdsChange: handleSelectedShapeIdsChange,
      onSelectedCanvasCardIdsChange: handleSelectedCanvasCardIdsChange,
      onActiveComposerCardIdChange: setActiveComposerCardId,
      onDraftPromptChange: handleDraftPromptChange,
      onDraftAnalysisDepthChange: handleDraftAnalysisDepthChange,
      onDraftTaskTypeChange: handleDraftTaskTypeChange,
      onDraftModelChange: handleDraftModelChange,
      onDraftAspectRatioChange: handleDraftAspectRatioChange,
      onDraftBackgroundSourceChange: handleDraftBackgroundSourceChange,
      onDraftCharacterOrientationChange:
        handleDraftCharacterOrientationChange,
      onDraftOutputQualityChange: handleDraftOutputQualityChange,
      onDraftModeChange: handleDraftModeChange,
      onDraftVariantChange: handleDraftVariantChange,
      onDraftQualityChange: handleDraftQualityChange,
      onDraftDurationChange: handleDraftDurationChange,
      onDraftLanguageChange: handleDraftLanguageChange,
      onOpenReferencePicker: (draftId, intent) =>
        openUploadPicker({ draftId, intent, mode: 'reference' }),
      onAttachCanvasReference: handleAttachCanvasReference,
      onDetachCanvasReference: handleDetachCanvasReference,
      onReorderCanvasReferences: handleReorderCanvasReferences,
      onPinGenerationOutput: handlePinGenerationOutput,
      onGenerateDraft: handleGenerateDraft,
    }),
    [
      activeComposerCardId,
      canUndoCanvas,
      canRedoCanvas,
      canvasCards,
      canvasCopy,
      handleDraftAspectRatioChange,
      handleDraftAnalysisDepthChange,
      handleDraftBackgroundSourceChange,
      handleDraftCharacterOrientationChange,
      handleDraftDurationChange,
      handleDraftLanguageChange,
      handleDraftModeChange,
      handleDraftModelChange,
      handleDraftOutputQualityChange,
      handleDraftPromptChange,
      handleDraftQualityChange,
      handleDraftTaskTypeChange,
      handleDraftVariantChange,
      handleGenerateDraft,
      handleCreatePromptDraft,
      handleAttachCanvasReference,
      handleCreateGenerationFromConnector,
      handleCreateGenerationAtPoint,
      handleDetachCanvasReference,
      handleReorderCanvasReferences,
      handlePinGenerationOutput,
      handleSelectedShapeIdsChange,
      handleSelectedCanvasCardIdsChange,
      metadataMap,
      imageModels,
      openUploadPicker,
      selectedShapeIds,
      selectedCanvasCardIds,
      setActiveComposerCardId,
      undoCanvas,
      redoCanvas,
      videoModels,
    ]
  );

  const shellMessage = errorMessage ?? statusMessage;
  const showShellMessage = Boolean(errorMessage || statusMessage);
  const selectedDraftCard = useMemo(
    () =>
      selectedCanvasCards.find(
        (card): card is CanvasDraftCard => card.kind === 'generation'
      ) ?? null,
    [selectedCanvasCards]
  );
  useEffect(() => {
    if (!selectedDraftCard) {
      return;
    }

    setActiveComposerCardId(selectedDraftCard.id);
  }, [selectedDraftCard?.id, setActiveComposerCardId]);
  const selectedShapeId =
    selectedShapeIds.length === 1 ? (selectedShapeIds[0] ?? null) : null;
  const selectedSingleCard = selectedShapeId
    ? canvasCards[selectedShapeId]
    : null;

  const selectedGroupCards = useMemo<CanvasCard[]>(() => {
    if (!selectedShapeId || selectedSingleCard) {
      return [];
    }

    const editor = editorRef.current;
    const selectedShape = editor?.getShape?.(selectedShapeId as any);

    if (selectedShape?.type !== 'group') {
      return [];
    }

    const childIds =
      editor?.getSortedChildIdsForParent?.(selectedShapeId as any) ?? [];

    return childIds
      .map((childId: string) => canvasCards[childId])
      .filter((card: CanvasCard | undefined): card is CanvasCard =>
        Boolean(card)
      );
  }, [canvasCards, editorRef, selectedShapeId, selectedSingleCard]);
  const effectiveSelectedGroupCards = useMemo(
    () =>
      resolveBatchCanvasCardSelection({
        cardsById: canvasCards,
        selectedCanvasCardIds,
        selectedGroupCards,
      }),
    [canvasCards, selectedCanvasCardIds, selectedGroupCards]
  );

  const downloadableGroupCards = useMemo(
    () =>
      effectiveSelectedGroupCards.filter((card: CanvasCard) =>
        isDownloadableCanvasCard(card)
      ),
    [effectiveSelectedGroupCards]
  );
  const isSingleDownloadable = isDownloadableCanvasCard(selectedSingleCard);
  const previewableSelectedCard = useMemo(
    () =>
      getPreviewableCanvasCardFromSelection({
        selectedSingleCard,
        selectedGroupCards: effectiveSelectedGroupCards,
      }),
    [effectiveSelectedGroupCards, selectedSingleCard]
  );
  const canPreviewSelection = Boolean(previewableSelectedCard);
  const isGroupSelected = effectiveSelectedGroupCards.length > 0;
  const canDownloadSelection =
    isSingleDownloadable || downloadableGroupCards.length > 0;
  const selectedCardsForActions = useMemo(
    () =>
      isGroupSelected
        ? effectiveSelectedGroupCards
        : selectedSingleCard
          ? [selectedSingleCard]
          : [],
    [effectiveSelectedGroupCards, isGroupSelected, selectedSingleCard]
  );
  const selectedTimelineMedia = useMemo(
    () =>
      selectedCardsForActions.flatMap((sourceCard) => {
        const mediaCard = resolveConcreteCanvasMediaCard({
          cards: canvasCards,
          card: sourceCard,
        });
        return mediaCard?.url &&
          mediaCard.assetId &&
          (mediaCard.type === 'video' || mediaCard.type === 'audio')
          ? [{ sourceCard, mediaCard }]
          : [];
      }),
    [canvasCards, selectedCardsForActions]
  );
  const canAddSelectionToTimeline = selectedTimelineMedia.length > 0;
  const continuationSelection =
    selectedTimelineMedia.length === 1 &&
    selectedTimelineMedia[0]?.mediaCard.type === 'video'
      ? selectedTimelineMedia[0]
      : null;
  const handleAddSelectionToTimeline = useCallback(() => {
    if (selectedTimelineMedia.length === 0 || isAddingSelectionToTimeline) return;
    setIsAddingSelectionToTimeline(true);
    void addProjectAssetsToTimeline({
      projectId,
      assets: selectedTimelineMedia.map(({ mediaCard }) => ({
        asset: {
          id: mediaCard.assetId as string,
          publicUrl: mediaCard.url!,
          filename: mediaCard.name,
          width: null,
          height: null,
          durationMs:
            typeof mediaCard.durationSec === 'number'
              ? mediaCard.durationSec * 1000
              : null,
          createdAt: new Date().toISOString(),
        },
        mediaType: mediaCard.type as 'video' | 'audio',
      })),
    })
      .then((saved) => {
        const document = saved.timeline?.document;
        if (!document) return;
        const cardId = `timeline:${document.id}`;
        const sourceCardIds = selectedTimelineMedia.map(
          ({ sourceCard }) => sourceCard.id
        );
        const clipCount = document.tracks.reduce(
          (count, track) => count + track.clips.length,
          0
        );
        const existing = canvasCardsRef.current[cardId];
        if (existing?.kind === 'asset' && existing.type === 'timeline') {
          recordCanvasHistory();
          updateCanvasCard(cardId, {
            durationSec: document.duration,
            clipCount,
            lastRenderAssetId: document.lastRenderAssetId,
            url: document.lastRenderUrl,
            referenceCardIds: Array.from(
              new Set([...existing.referenceCardIds, ...sourceCardIds])
            ),
          });
          const timelineShape = editorRef.current?.getShape?.(cardId as any) as
            | { type: string; props?: Record<string, unknown> }
            | undefined;
          if (timelineShape) {
            editorRef.current?.updateShape?.({
              id: cardId,
              type: timelineShape.type,
              props: {
                ...timelineShape.props,
                title: document.name,
                thumbnailUrl: document.lastRenderUrl ?? '',
                durationSec: document.duration,
                timelineId: document.id,
                clipCount,
              },
            } as any);
          }
          for (const sourceCardId of sourceCardIds) {
            createConnectorBetweenCards(sourceCardId, cardId);
          }
          focusShape(cardId);
        } else {
          insertAssetCard({
            type: 'timeline',
            url: document.lastRenderUrl,
            name: document.name,
            assetId: document.lastRenderAssetId,
            sourceCardIds,
            anchorCardIds: sourceCardIds,
            shapeId: cardId,
            size: { w: 360, h: 220 },
            durationSec: document.duration,
            timelineId: document.id,
            clipCount,
            lastRenderAssetId: document.lastRenderAssetId,
          });
        }
        toast.success(
          projectAssetsT(
            selectedTimelineMedia.length > 1
              ? 'timelineCreated'
              : 'addedToTimeline'
          )
        );
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setIsAddingSelectionToTimeline(false));
  }, [
    canvasCardsRef,
    createConnectorBetweenCards,
    editorRef,
    focusShape,
    insertAssetCard,
    isAddingSelectionToTimeline,
    projectAssetsT,
    projectId,
    recordCanvasHistory,
    selectedTimelineMedia,
    updateCanvasCard,
  ]);

  const handleContinueFromTailFrame = useCallback(() => {
    if (
      !continuationSelection?.mediaCard.url ||
      !continuationSelection.mediaCard.assetId ||
      isContinuingVideo
    )
      return;
    const { mediaCard, sourceCard } = continuationSelection;
    void (async () => {
      setIsContinuingVideo(true);
      setErrorMessage(null);
      setStatusMessage(projectAssetsT('extractingTailFrame'));
      try {
        const frame = await extractVideoFrame({
          url: mediaCard.url!,
          position: 'last',
          filename: `${sanitizeDownloadName(mediaCard.name) || 'video'}-tail-frame.png`,
        });
        const asset = await uploadLocalProjectAsset({
          projectId,
          file: frame.file,
          assetClass: 'derived',
          metadata: {
            operation: 'video_tail_frame',
            parentAssetId: mediaCard.assetId,
            sourceCardId: sourceCard.id,
            sourceTimeSec: frame.timeSeconds,
            sourceDurationSec: frame.durationSeconds,
            relation: 'continuation_first_frame',
          },
        });
        await invalidateWorkspaceAfterAssetMutation(queryClient);
        const maxEdge = 320;
        const ratio = frame.width / frame.height;
        const size =
          ratio >= 1
            ? { w: maxEdge, h: Math.round(maxEdge / ratio) }
            : { w: Math.round(maxEdge * ratio), h: maxEdge };
        const tailFrameCardId = insertAssetCard({
          type: 'image',
          url: asset.publicUrl,
          name: projectAssetsT('tailFrameName', { name: mediaCard.name }),
          assetId: asset.id,
          sourceCardIds: [sourceCard.id],
          anchorCardIds: [sourceCard.id],
          size,
          fitMode: 'contain',
        });
        if (!tailFrameCardId) {
          throw new Error(projectAssetsT('tailFrameInsertFailed'));
        }
        const nextDraftId = createDraftCard({
          taskType: 'video',
          prompt: '',
          referenceCardIds: [tailFrameCardId],
          anchorCardIds: [tailFrameCardId],
          placementSide: 'right',
        });
        if (!nextDraftId) {
          throw new Error(projectAssetsT('continuationInsertFailed'));
        }
        setStatusMessage('');
        toast.success(projectAssetsT('continuationReady'), {
          id: `continuation-${sourceCard.id}`,
        });
      } catch (error) {
        setStatusMessage('');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : projectAssetsT('tailFrameFailed')
        );
      } finally {
        setIsContinuingVideo(false);
      }
    })();
  }, [
    continuationSelection,
    createDraftCard,
    insertAssetCard,
    isContinuingVideo,
    projectAssetsT,
    projectId,
    queryClient,
  ]);

  const resolveDownloadUrl = useCallback((card: CanvasCard) => {
    if (!card.url) {
      return null;
    }

    if (card.sourceGenerationId) {
      const params = new URLSearchParams({
        taskId: card.sourceGenerationId,
      });
      return `/api/assets/download?${params.toString()}`;
    }

    return card.url;
  }, []);

  const inferDownloadFileName = useCallback(
    (card: CanvasCard) => {
      const baseName = sanitizeDownloadName(card.name) || 'asset';
      const sourceUrl = resolveDownloadUrl(card) ?? card.url ?? '';

      try {
        const pathname = new URL(sourceUrl, window.location.origin).pathname;
        const extension = pathname.split('.').pop()?.toLowerCase();
        if (extension && extension.length <= 5) {
          return `${baseName}.${extension}`;
        }
      } catch {}

      const fallbackExtension =
        card.type === 'video' || card.type === 'timeline'
          ? 'mp4'
          : card.type === 'audio'
            ? 'mp3'
            : 'png';
      return `${baseName}.${fallbackExtension}`;
    },
    [resolveDownloadUrl]
  );

  const fetchDownloadBlob = useCallback(
    async (card: CanvasCard) => {
      const downloadUrl = resolveDownloadUrl(card);
      if (!downloadUrl) {
        throw new Error('Missing download URL');
      }

      let response = await fetch(downloadUrl);
      if (!response.ok && card.url && card.url !== downloadUrl) {
        response = await fetch(card.url);
      }

      if (!response.ok) {
        throw new Error(`Failed to download ${card.name}`);
      }

      const blob = await response.blob();
      return {
        blob,
        fileName: inferDownloadFileName(card),
      };
    },
    [inferDownloadFileName, resolveDownloadUrl]
  );

  const triggerBrowserDownload = useCallback((blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, []);

  const handleDownloadSelection = useCallback(async () => {
    try {
      if (isSingleDownloadable && selectedSingleCard) {
        const { blob, fileName } = await fetchDownloadBlob(selectedSingleCard);
        triggerBrowserDownload(blob, fileName);
        return;
      }

      if (downloadableGroupCards.length > 0) {
        const [{ default: JSZip }, files] = await Promise.all([
          import('jszip'),
          Promise.all(
            downloadableGroupCards.map((card: CanvasCard) =>
              fetchDownloadBlob(card)
            )
          ),
        ]);
        const zip = new JSZip();
        files.forEach(({ blob, fileName }, index) => {
          zip.file(`${String(index + 1).padStart(2, '0')}-${fileName}`, blob);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerBrowserDownload(zipBlob, 'canvas-group-assets.zip');
        return;
      }

      toast.error(studioT('messages.noDownloadableAssets'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : studioT('messages.noDownloadableAssets');
      toast.error(message);
    }
  }, [
    downloadableGroupCards,
    fetchDownloadBlob,
    isSingleDownloadable,
    selectedSingleCard,
    studioT,
    triggerBrowserDownload,
  ]);
  const handlePreviewSelection = useCallback(() => {
    if (!previewableSelectedCard?.url) {
      return;
    }

    setActiveComposerCardId(null);
    setPreviewMedia({
      type: previewableSelectedCard.type,
      url: previewableSelectedCard.url,
      title:
        previewableSelectedCard.name ||
        studioT(
          previewableSelectedCard.type === 'video'
            ? 'canvas.frame.videoTitle'
            : 'canvas.frame.imageTitle'
        ),
    });
  }, [previewableSelectedCard, setActiveComposerCardId, studioT]);

  useEffect(() => {
    const handlePreviewMediaEvent = (event: Event) => {
      const detail = (event as CustomEvent<BeatCanvasPreviewMedia>).detail;
      if (
        (detail?.type !== 'image' && detail?.type !== 'video') ||
        !detail.url
      ) {
        return;
      }

      setActiveComposerCardId(null);
      setPreviewMedia({
        type: detail.type,
        url: detail.url,
        title:
          detail.title ||
          studioT(
            detail.type === 'video'
              ? 'canvas.frame.videoTitle'
              : 'canvas.frame.imageTitle'
          ),
      });
    };

    window.addEventListener('beatcanvas:preview-media', handlePreviewMediaEvent);
    return () => {
      window.removeEventListener(
        'beatcanvas:preview-media',
        handlePreviewMediaEvent
      );
    };
  }, [setActiveComposerCardId, studioT]);

  useEffect(() => {
    const handlePinGenerationOutputEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<{ draftId?: string; outputId?: string }>
      ).detail;
      if (!detail?.draftId || !detail.outputId) {
        return;
      }
      handlePinGenerationOutput(detail.draftId, detail.outputId);
    };

    window.addEventListener(
      'beatcanvas:pin-generation-output',
      handlePinGenerationOutputEvent
    );
    return () => {
      window.removeEventListener(
        'beatcanvas:pin-generation-output',
        handlePinGenerationOutputEvent
      );
    };
  }, [handlePinGenerationOutput]);

  const contextDownloadLabel = isGroupSelected
    ? studioT('multiSelect.batchDownload')
    : isSingleDownloadable
      ? studioT('multiSelect.download')
      : null;
  const showContextToolbar = Boolean(
    canPreviewSelection ||
      isSingleDownloadable ||
      isGroupSelected ||
      canAddSelectionToTimeline
  );
  const snapshotChangeSignal = useMemo(
    () => ({
      cards: canvasCards,
      canvasDocumentRevision,
    }),
    [canvasDocumentRevision, canvasCards]
  );

  const activeTemplateProjectWorkflowSnapshot =
    useMemo<ProjectSnapshotActiveTemplateWorkflow | null>(
      () => initialProjectSnapshot?.workflows?.activeTemplate ?? null,
      [initialProjectSnapshot]
    );

  const buildProjectSnapshotDocument = useCallback(() => {
    const nextDocument = buildCanvasProjectSnapshotDocument();
    const workflows = {
      ...(nextDocument.workflows ?? {}),
      ...(activeTemplateProjectWorkflowSnapshot
        ? { activeTemplate: activeTemplateProjectWorkflowSnapshot }
        : {}),
    };

    return Object.keys(workflows).length > 0
      ? {
          ...nextDocument,
          workflows,
        }
      : nextDocument;
  }, [activeTemplateProjectWorkflowSnapshot, buildCanvasProjectSnapshotDocument]);

  const restoreProjectSnapshot = useCallback(
    (
      document: import(
        '@/core/projects/project-snapshot'
      ).ProjectSnapshotDocument
    ) => {
      restoreCanvasProjectSnapshot(document);
      resumeInFlightGenerations();
    },
    [restoreCanvasProjectSnapshot, resumeInFlightGenerations]
  );

  const handleEmptyProjectSnapshotSaved = useCallback(() => {
    setAllowEmptyProjectSnapshot(false);
  }, []);

  const handleProjectSnapshotConflict = useCallback(() => {
    toast.error(studioT('messages.snapshotConflict'));
  }, [studioT]);

  useProjectSnapshotLifecycle({
    projectId,
    projectPath,
    initialProjectSnapshot,
    initialProjectSnapshotVersion,
    initialPrompt,
    initialTaskType,
    isCanvasReady,
    snapshotChangeSignal,
    allowEmptyProjectSnapshot,
    buildProjectSnapshotDocument,
    restoreProjectSnapshot,
    createDraftCard,
    onEmptyProjectSnapshotSaved: handleEmptyProjectSnapshotSaved,
    onProjectSnapshotConflict: handleProjectSnapshotConflict,
  });

  // Listen for card connector events from the overlay
  useEffect(() => {
    const handleConnect = (e: Event) => {
      const { sourceCardId, targetCardId } = (e as CustomEvent).detail;
      if (sourceCardId && targetCardId && sourceCardId !== targetCardId) {
        const sourceCard = canvasCardsRef.current[sourceCardId];
        const targetCard = canvasCardsRef.current[targetCardId];
        if (!sourceCard || targetCard?.kind !== 'generation') {
          return;
        }

        if (
          targetCard.generationMode === 'analysis' &&
          !targetCard.referenceCardIds?.includes(sourceCardId) &&
          (targetCard.referenceCardIds?.length ?? 0) >= 1
        ) {
          return;
        }

        const models = targetCard.type === 'image' ? imageModels : videoModels;
        const targetModel = getSelectableModel(models, targetCard.modelId);
        if (
          !canUseCanvasCardAsGenerationReference({
          sourceCard,
          targetType: targetCard.type,
          targetModel,
          targetGenerationMode: targetCard.generationMode,
        })
        ) {
          return;
        }

        createConnectorBetweenCards(sourceCardId, targetCardId, {
          recordHistory: true,
        });
        updateDraftCard(targetCardId, {
          referenceCardIds: [
            ...new Set([
              ...(targetCard.referenceCardIds ?? []),
              sourceCardId,
            ]),
          ],
        });
      }
    };
    window.addEventListener('beatcanvas:connect-cards', handleConnect);
    return () =>
      window.removeEventListener('beatcanvas:connect-cards', handleConnect);
  }, [
    createConnectorBetweenCards,
    canvasCardsRef,
    imageModels,
    updateDraftCard,
    videoModels,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetContext = getCanvasShortcutTargetContext(event.target);
      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey;

      if (
        hasModifier &&
        !shouldIgnoreCanvasModifierShortcut({
          ...targetContext,
          isComposing: event.isComposing,
          defaultPrevented: event.defaultPrevented,
        })
      ) {
        if (key === 'z' && event.shiftKey) {
          event.preventDefault();
          redoCanvas();
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          undoCanvas();
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          redoCanvas();
          return;
        }
        if (key === 'c') {
          if (copySelectedCanvasCards()) {
            event.preventDefault();
          }
          return;
        }
        if (key === 'v') {
          if (pasteCanvasCards()) {
            event.preventDefault();
          }
        }
        return;
      }

      if (
        shouldIgnoreCanvasShortcut({
          ...targetContext,
          isComposing: event.isComposing,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          defaultPrevented: event.defaultPrevented,
        })
      ) {
        return;
      }

      if (event.shiftKey && key === 'i') {
        event.preventDefault();
        openUploadPicker({
          intent: 'image',
          mode: 'global',
        });
        return;
      }

      if (event.shiftKey && key === 'v') {
        event.preventDefault();
        openUploadPicker({
          intent: 'video',
          mode: 'global',
        });
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        handleCreatePromptDraft('image');
        return;
      }

      if (key === 'm') {
        event.preventDefault();
        handleCreatePromptDraft('video');
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [
    copySelectedCanvasCards,
    handleCreatePromptDraft,
    openUploadPicker,
    pasteCanvasCards,
    redoCanvas,
    undoCanvas,
  ]);

  // Register card connector "+" button handler
  useEffect(() => {
    registerCardConnectorCallback((shapeId, side) => {
      const card = canvasCardsRef.current[shapeId];
      if (!card) return;

      if (side === 'output') {
        handleCreatePromptDraft(card.type === 'video' ? 'video' : 'image');
      } else {
        // Open reference upload targeting this card
        openUploadPicker({
          intent: card.type === 'video' ? 'video' : 'image',
          mode: 'reference',
          draftId: shapeId,
        });
      }
    });
    return () => registerCardConnectorCallback(null);
  }, [canvasCardsRef, handleCreatePromptDraft, openUploadPicker]);

  const handleEditorMount = useCallback(
    (editor: unknown) => {
      editorRef.current = editor as any;

      if (typeof editorRef.current?.setCurrentTool === 'function') {
        editorRef.current.setCurrentTool('select');
      }

      setIsCanvasReady(true);
    },
    [editorRef]
  );

  const handleCanvasDocumentChange = useCallback(() => {
    if (Object.keys(canvasCardsRef.current).length > 0) {
      setAllowEmptyProjectSnapshot(false);
    }
    setCanvasDocumentRevision((current) => current + 1);
  }, [canvasCardsRef]);

  const handleCanvasShapeIdsRemoved = useCallback(
    (shapeIds: string[]) => {
      removeCanvasCardsForShapes(shapeIds);
      if (Object.keys(canvasCardsRef.current).length === 0) {
        setAllowEmptyProjectSnapshot(true);
      }
      setCanvasDocumentRevision((current) => current + 1);
    },
    [canvasCardsRef, removeCanvasCardsForShapes]
  );

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[var(--beatcanvas-canvas-bg)]">
      <input
        ref={mediaFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
        multiple
        className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px opacity-0"
        onChange={handleMediaUpload}
      />
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
        multiple
        className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px opacity-0"
        onChange={handleUpload('image')}
      />
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov"
        className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px opacity-0"
        onChange={handleUpload('video')}
      />

      {/* Canvas area */}
      <div className="relative flex-1 min-w-0">
        <BeatCanvasFrontLayerProvider value={frontLayerValue}>
          <Suspense fallback={<BeatCanvasLoading />}>
            <BeatCanvasReactFlowEditor
              onMount={handleEditorMount}
              onDocumentChange={handleCanvasDocumentChange}
              onHistoryCheckpoint={recordCanvasHistory}
              onShapeIdsRemoved={handleCanvasShapeIdsRemoved}
              onReferenceEdgesRemoved={handleReferenceEdgesRemoved}
              components={canvasComponents}
            />
          </Suspense>
        </BeatCanvasFrontLayerProvider>

        <div className="pointer-events-none absolute inset-0">
          {/* Floating Left Toolbar */}
          <BeatCanvasSidebar
            projectId={projectId}
            onUploadMedia={openMediaUploadPicker}
            onCreateImageDraft={() => handleCreatePromptDraft('image')}
            onInsertHistoryAsset={(asset) =>
              insertProjectAsset({ ...asset, projectId })
            }
            uploadIntent={uploadIntent as UploadIntent | null}
          />

          {showContextToolbar ? (
            <Suspense fallback={null}>
              <BeatCanvasContextToolbar
                canDownload={canDownloadSelection}
                canPreview={canPreviewSelection}
                downloadLabel={contextDownloadLabel}
                isBatchDownload={isGroupSelected}
                previewLabel={
                  canPreviewSelection
                    ? studioT('multiSelect.preview')
                    : null
                }
                onDownload={() => {
                  void handleDownloadSelection();
                }}
                onPreview={handlePreviewSelection}
                continueVideoLabel={
                  continuationSelection
                    ? projectAssetsT('continueFromTailFrame')
                    : null
                }
                canContinueVideo={Boolean(
                  continuationSelection && !isContinuingVideo
                )}
                onContinueVideo={handleContinueFromTailFrame}
                addToTimelineLabel={
                  canAddSelectionToTimeline
                    ? projectAssetsT(
                        selectedTimelineMedia.length > 1
                          ? 'createTimeline'
                          : 'addToTimeline'
                      )
                    : null
                }
                canAddToTimeline={
                  canAddSelectionToTimeline && !isAddingSelectionToTimeline
                }
                onAddToTimeline={handleAddSelectionToTimeline}
              />
            </Suspense>
          ) : null}

          {previewMedia ? (
            <Suspense fallback={null}>
              <BeatCanvasMediaPreviewOverlay
                media={previewMedia}
                closeLabel={studioT('multiSelect.closePreview')}
                onClose={() => setPreviewMedia(null)}
              />
            </Suspense>
          ) : null}

          {showShellMessage && !showContextToolbar ? (
            <Suspense fallback={null}>
              <BeatCanvasStatusPill
                message={shellMessage}
                isError={Boolean(errorMessage)}
              />
            </Suspense>
          ) : null}

          {/* Agent panel removed */}
        </div>
      </div>
    </div>
  );
}
