'use client';

import { useEffectMetadata } from '@/core/workspace-hooks/use-workspace-metadata';
import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type {
  CanvasCard,
  CanvasDraftCard,
  CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import {
  isCanvasDraftCard,
  isCanvasAnalysisCard,
  isCanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import { resolveOutputMedia } from '@/core/effects/output-media';
import {
  resolveVideoAnalysisText,
  VIDEO_ANALYSIS_EFFECT_ID,
} from '@/core/effects/video-analysis';
import {
  type StudioJobStatus,
  buildGenerationEffectInput,
  getJobStatusLabel,
  getSelectableModel,
  pollGenerationUntilComplete,
  runDraftGeneration,
} from '@/core/beatcanvas/generation-controller';
import {
  buildEffectMetadataMap,
  getDraftUploadFailureMessage,
} from '@/core/beatcanvas/studio/generation-runtime';
import type { MutableRefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import type { StudioTranslateFn } from './beatcanvas-types';

type GenerateDraftOptions = {
  suppressSuccessToast?: boolean;
  suppressResultFocus?: boolean;
  batchIndex?: number;
  batchTotal?: number;
};

export function useBeatCanvasGenerationRuntime({
  projectId,
  studioT,
  canvasCardsRef,
  imageModels,
  isCanvasReady = true,
  videoModels,
  getPendingUploadCountForDraft,
  promotePendingUploadsForDraft,
  createGenerationOutput,
  updateGenerationOutput,
  completeGenerationOutput,
  setErrorMessage,
  setStatusMessage,
  updateDraftCard,
  onGenerationComplete,
}: {
  projectId: string;
  studioT: StudioTranslateFn;
  canvasCardsRef: MutableRefObject<Record<string, CanvasCard>>;
  imageModels: WorkspaceModelOption[];
  isCanvasReady?: boolean;
  videoModels: WorkspaceModelOption[];
  getPendingUploadCountForDraft: (draftId: string) => number;
  promotePendingUploadsForDraft: (
    draftId: string,
    generationIntentToken: string
  ) => Promise<Record<string, string>>;
  createGenerationOutput: (params: {
    draftCard: CanvasDraftCard;
    name: string;
    suppressFocus?: boolean;
  }) => string | null;
  updateGenerationOutput: (
    outputCardId: string,
    patch: Partial<CanvasOutputCard>
  ) => void;
  completeGenerationOutput: (params: {
    outputCardId: string;
    draftCard: CanvasDraftCard;
    url?: string | null;
    resultText?: string | null;
    name: string;
    sourceGenerationId?: string | null;
    suppressFocus?: boolean;
  }) => string | null;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string) => void;
  updateDraftCard: (
    draftId: string,
    updater:
      | Partial<CanvasDraftCard>
      | ((current: CanvasDraftCard) => CanvasDraftCard)
  ) => void;
  onGenerationComplete?: () => void;
}) {
  const statusLabels = useMemo(
    () => ({
      idle: studioT('status.labels.idle'),
      pending: studioT('status.labels.pending'),
      processing: studioT('status.labels.processing'),
      succeeded: studioT('status.labels.succeeded'),
      failed: studioT('status.labels.failed'),
    }),
    [studioT]
  );

  const runtimeMessages = useMemo(
    () => ({
      missingVideoUrl: studioT('messages.missingVideoUrl'),
      readVideoDurationFailed: studioT('messages.readVideoDurationFailed'),
      videoMetadataLoadFailed: studioT('messages.videoMetadataLoadFailed'),
    }),
    [studioT]
  );

  const effectIds = useMemo(() => {
    return [
      ...new Set([...imageModels, ...videoModels].map((item) => item.effectId)),
    ];
  }, [imageModels, videoModels]);
  const { data: effectMetadata } = useEffectMetadata(effectIds, {
    enabled: isCanvasReady,
  });
  const metadataMap = useMemo(
    () => buildEffectMetadataMap(effectMetadata ?? {}),
    [effectMetadata]
  );

  const buildEffectInput = useCallback(
    (
      draftCard: CanvasDraftCard,
      referenceUrlOverrides?: Record<string, string>
    ) =>
      buildGenerationEffectInput({
        draftCard,
        canvasCards: canvasCardsRef.current,
        referenceUrlOverrides,
        imageModels,
        videoModels,
        metadataMap,
        runtimeMessages,
        translate: studioT,
        notify: (message) => {
          toast(message);
        },
      }),
    [
      canvasCardsRef,
      imageModels,
      metadataMap,
      runtimeMessages,
      studioT,
      videoModels,
    ]
  );

  const pollEffectUntilComplete = useCallback(
    ({
      wmTaskId,
      effectId,
      onStatus,
    }: {
      wmTaskId: string;
      effectId: number;
      onStatus?: (status: StudioJobStatus, message: string) => void;
    }) =>
      pollGenerationUntilComplete({
        wmTaskId,
        effectId,
        onStatus,
        statusLabels,
        translate: studioT,
      }),
    [statusLabels, studioT]
  );

  const runGenerateDraft = useCallback(
    async (draftId: string, options?: GenerateDraftOptions) => {
      const completed = await runDraftGeneration({
        draftId,
        projectId,
        getCurrentCard: (nextDraftId) => canvasCardsRef.current[nextDraftId],
        buildEffectInput: async (draftCard) => {
          const result = await buildEffectInput(draftCard);
          if (draftCard.workflowTemplateId) {
            result.input.wmWorkflowTemplateId = draftCard.workflowTemplateId;
          }
          if (options?.batchIndex && options.batchTotal) {
            result.input.wmBatchIndex = options.batchIndex;
            result.input.wmBatchTotal = options.batchTotal;
          }
          return result;
        },
        getExpectedUploadCount: () => getPendingUploadCountForDraft(draftId),
        updateDraftCard,
        createGenerationOutput,
        updateGenerationOutput,
        completeGenerationOutput,
        suppressResultFocus: options?.suppressResultFocus,
        setStatusMessage,
        setErrorMessage,
        getStatusLabel: (status) => getJobStatusLabel(status, statusLabels),
        translate: studioT,
        notifySuccess: (message) => {
          if (options?.suppressSuccessToast) {
            return;
          }

          toast.success(message);
        },
        notifyError: (message) => {
          toast.error(message);
        },
        prepareAfterPrecheck: async ({ uploadIntentToken }) => {
          if (!uploadIntentToken) {
            throw new Error(studioT('messages.requestValidationFailed'));
          }
          setStatusMessage(studioT('messages.preparingAssets'));
          try {
            return await promotePendingUploadsForDraft(
              draftId,
              uploadIntentToken
            );
          } catch (error) {
            throw new Error(
              getDraftUploadFailureMessage({
                error,
                fallbackMessage: studioT('messages.uploadFailed'),
              })
            );
          }
        },
        pollEffectUntilCompleteImpl: pollEffectUntilComplete,
      });
      onGenerationComplete?.();
      return completed;
    },
    [
      buildEffectInput,
      canvasCardsRef,
      getPendingUploadCountForDraft,
      onGenerationComplete,
      pollEffectUntilComplete,
      projectId,
      promotePendingUploadsForDraft,
      createGenerationOutput,
      updateGenerationOutput,
      completeGenerationOutput,
      statusLabels,
      studioT,
      updateDraftCard,
    ]
  );

  const handleGenerateDraft = useCallback(
    (draftId: string) => {
      void runGenerateDraft(draftId);
    },
    [runGenerateDraft]
  );

  const resumedRunIdsRef = useRef<Set<string>>(new Set());

  /**
   * Re-attach polling to generations that were still pending/processing when
   * the page was last closed. Their task ids are persisted on the output
   * cards (sourceGenerationId), so results land back on the canvas.
   */
  const resumeInFlightGenerations = useCallback(() => {
    const inFlightOutputs = Object.values(canvasCardsRef.current).filter(
      (card): card is CanvasOutputCard =>
        isCanvasOutputCard(card) &&
        (card.status === 'pending' || card.status === 'processing') &&
        Boolean(card.sourceGenerationId) &&
        !resumedRunIdsRef.current.has(card.generationRunId ?? card.id)
    );

    for (const outputCard of inFlightOutputs) {
      const draftCard = canvasCardsRef.current[outputCard.sourceConfigCardId];
      if (!isCanvasDraftCard(draftCard)) {
        continue;
      }

      const isAnalysis =
        outputCard.generationSnapshot.generationMode === 'analysis' ||
        isCanvasAnalysisCard(draftCard);
      const models = outputCard.generationSnapshot.type === 'image'
        ? imageModels
        : videoModels;
      const model = isAnalysis
        ? null
        : getSelectableModel(models, outputCard.generationSnapshot.modelId);
      if (!isAnalysis && !model) continue;

      resumedRunIdsRef.current.add(
        outputCard.generationRunId ?? outputCard.id
      );

      if (
        draftCard.status !== 'pending' &&
        draftCard.status !== 'processing'
      ) {
        updateDraftCard(draftCard.id, {
          status: outputCard.status,
          error: null,
        });
      }

      void (async () => {
        const wmTaskId = outputCard.sourceGenerationId as string;
        try {
          const output = await pollEffectUntilComplete({
            wmTaskId,
            effectId: isAnalysis ? VIDEO_ANALYSIS_EFFECT_ID : model!.effectId,
            onStatus: (status, message) => {
              updateGenerationOutput(outputCard.id, { status });
              const latestDraft = canvasCardsRef.current[draftCard.id];
              if (isCanvasDraftCard(latestDraft)) {
                updateDraftCard(latestDraft.id, { status });
              }
              setStatusMessage(message);
            },
          });

          const resultText = isAnalysis
            ? resolveVideoAnalysisText(output)
            : null;
          const resolvedMedia = isAnalysis ? null : resolveOutputMedia(output);
          if (isAnalysis ? !resultText : !resolvedMedia?.resultUrl) {
            throw new Error(studioT('messages.generationFailed'));
          }

          const latestDraft = canvasCardsRef.current[draftCard.id];
          if (!isCanvasDraftCard(latestDraft)) {
            return;
          }

          completeGenerationOutput({
            outputCardId: outputCard.id,
            draftCard: latestDraft,
            url: resolvedMedia?.resultUrl ?? null,
            resultText,
            name: outputCard.name,
            sourceGenerationId: wmTaskId,
            suppressFocus: true,
          });
          updateDraftCard(latestDraft.id, {
            status: 'idle',
            error: null,
          });
          onGenerationComplete?.();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : studioT('messages.generationFailed');
          updateGenerationOutput(outputCard.id, {
            status: 'failed',
            error: message,
          });
          const latestDraft = canvasCardsRef.current[draftCard.id];
          if (
            isCanvasDraftCard(latestDraft) &&
            latestDraft.status !== 'pending' &&
            latestDraft.status !== 'processing'
          ) {
            updateDraftCard(latestDraft.id, {
              status: 'idle',
              error: null,
            });
          }
        }
      })();
    }
  }, [
    canvasCardsRef,
    completeGenerationOutput,
    imageModels,
    onGenerationComplete,
    pollEffectUntilComplete,
    setStatusMessage,
    studioT,
    updateDraftCard,
    updateGenerationOutput,
    videoModels,
  ]);

  return {
    handleGenerateDraft,
    metadataMap,
    resumeInFlightGenerations,
    runGenerateDraft,
  };
}
