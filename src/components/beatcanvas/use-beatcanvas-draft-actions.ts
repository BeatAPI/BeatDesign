'use client';

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
  CanvasDraftCard,
} from '@/core/beatcanvas/canvas-types';
import { isCanvasDraftCard } from '@/core/beatcanvas/canvas-types';
import {
  getCompatibleDraftModelSettings,
  isDraftBusyStatus,
} from '@/core/beatcanvas/composer';
import { getDraftDefaultsFromModel } from '@/core/beatcanvas/draft-defaults';
import { getSelectableModel } from '@/core/beatcanvas/generation-controller';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

import type { StudioTranslateFn } from './beatcanvas-types';

export function useBeatCanvasDraftActions({
  canvasCardsRef,
  selectedCanvasCardIds,
  imageModels,
  videoModels,
  initialImageModelId,
  initialVideoModelId,
  studioT,
  createDraftCard,
  setActiveComposerCardId,
  updateDraftCard,
}: {
  canvasCardsRef: MutableRefObject<Record<string, CanvasCard>>;
  selectedCanvasCardIds: string[];
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  initialImageModelId: string | null;
  initialVideoModelId: string | null;
  studioT: StudioTranslateFn;
  createDraftCard: (input: {
    taskType: CanvasCardMediaType;
    prompt: string;
    referenceCardIds: string[];
    workflowTemplateId?: string | null;
    presetName?: string;
    placementSide?: 'left' | 'right';
    connectReferences?: boolean;
  }) => string | null;
  setActiveComposerCardId: (cardId: string | null) => void;
  updateDraftCard: (
    draftId: string,
    updater:
      | Partial<CanvasDraftCard>
      | ((current: CanvasDraftCard) => CanvasDraftCard)
  ) => void;
}) {
  const handleCreatePromptDraft = useCallback(
    (taskType: CanvasCardMediaType) => {
      const primaryReferenceId =
        selectedCanvasCardIds.length === 1 ? selectedCanvasCardIds[0] : null;
      const primaryReferenceCard = primaryReferenceId
        ? canvasCardsRef.current[primaryReferenceId]
        : null;
      const referenceCardIds =
        primaryReferenceCard && primaryReferenceCard.kind !== 'generation'
          ? [primaryReferenceCard.id]
          : [];

      createDraftCard({
        taskType,
        prompt: '',
        referenceCardIds,
      });
    },
    [canvasCardsRef, createDraftCard, selectedCanvasCardIds]
  );

  const handleDraftPromptChange = useCallback(
    (draftId: string, prompt: string) => {
      const currentCard = canvasCardsRef.current[draftId];
      if (
        !isCanvasDraftCard(currentCard) ||
        isDraftBusyStatus(currentCard.status)
      ) {
        return;
      }

      updateDraftCard(draftId, {
        prompt,
        status: 'idle',
        error: null,
      });
    },
    [canvasCardsRef, updateDraftCard]
  );

  const handleDraftTaskTypeChange = useCallback(
    (draftId: string, taskType: CanvasCardMediaType) => {
      const currentCard = canvasCardsRef.current[draftId];
      if (
        !isCanvasDraftCard(currentCard) ||
        isDraftBusyStatus(currentCard.status)
      ) {
        return;
      }

      const model =
        taskType === 'image'
          ? getSelectableModel(imageModels, initialImageModelId)
          : getSelectableModel(videoModels, initialVideoModelId);
      const defaults = getDraftDefaultsFromModel(taskType, model);

      updateDraftCard(draftId, (current) => ({
        ...current,
        type: taskType,
        name:
          taskType === 'image'
            ? studioT('canvas.frame.imageTitle')
            : studioT('canvas.frame.videoTitle'),
        modelId: defaults.modelId,
        aspectRatio: defaults.aspectRatio,
        outputQuality: defaults.outputQuality,
        duration: defaults.duration,
        language: defaults.language,
        mode: defaults.mode,
        variant: defaults.variant,
        quality: defaults.quality,
        characterOrientation: defaults.characterOrientation,
        backgroundSource: defaults.backgroundSource,
        status: 'idle',
        error: null,
      }));
      setActiveComposerCardId(draftId);
    },
    [
      canvasCardsRef,
      imageModels,
      initialImageModelId,
      initialVideoModelId,
      setActiveComposerCardId,
      studioT,
      updateDraftCard,
      videoModels,
    ]
  );

  const handleDraftModelChange = useCallback(
    (draftId: string, modelId: string) => {
      const currentCard = canvasCardsRef.current[draftId];
      if (
        !isCanvasDraftCard(currentCard) ||
        isDraftBusyStatus(currentCard.status)
      ) {
        return;
      }

      const model =
        currentCard.type === 'image'
          ? getSelectableModel(imageModels, modelId)
          : getSelectableModel(videoModels, modelId);

      if (!model) return;

      const nextSettings = getCompatibleDraftModelSettings({
        draftCard: currentCard,
        model,
      });

      updateDraftCard(draftId, (current) => ({
        ...current,
        modelId: model.id,
        ...nextSettings,
        status: 'idle',
        error: null,
      }));
      setActiveComposerCardId(draftId);
    },
    [
      canvasCardsRef,
      imageModels,
      setActiveComposerCardId,
      updateDraftCard,
      videoModels,
    ]
  );

  const updateEditableDraft = useCallback(
    <TValue>(
      draftId: string,
      patch: (value: TValue) => Partial<CanvasDraftCard>
    ) => {
      return (value: TValue) => {
        const currentCard = canvasCardsRef.current[draftId];
        if (
          !isCanvasDraftCard(currentCard) ||
          isDraftBusyStatus(currentCard.status)
        ) {
          return;
        }

        updateDraftCard(draftId, {
          ...patch(value),
          status: 'idle',
          error: null,
        });
        setActiveComposerCardId(draftId);
      };
    },
    [canvasCardsRef, setActiveComposerCardId, updateDraftCard]
  );

  const handleDraftAspectRatioChange = useCallback(
    (draftId: string, aspectRatio: WorkspaceAspectRatio) =>
      updateEditableDraft(draftId, (value: WorkspaceAspectRatio) => ({
        aspectRatio: value,
      }))(aspectRatio),
    [updateEditableDraft]
  );

  const handleDraftOutputQualityChange = useCallback(
    (draftId: string, outputQuality: WorkspaceOutputQuality) =>
      updateEditableDraft(draftId, (value: WorkspaceOutputQuality) => ({
        outputQuality: value,
      }))(outputQuality),
    [updateEditableDraft]
  );

  const handleDraftModeChange = useCallback(
    (draftId: string, mode: WorkspaceModelMode) =>
      updateEditableDraft(draftId, (value: WorkspaceModelMode) => ({
        mode: value,
      }))(mode),
    [updateEditableDraft]
  );

  const handleDraftVariantChange = useCallback(
    (draftId: string, variant: WorkspaceModelVariant) =>
      updateEditableDraft(draftId, (value: WorkspaceModelVariant) => ({
        variant: value,
      }))(variant),
    [updateEditableDraft]
  );

  const handleDraftQualityChange = useCallback(
    (draftId: string, quality: WorkspaceQualityOption) =>
      updateEditableDraft(draftId, (value: WorkspaceQualityOption) => ({
        quality: value,
      }))(quality),
    [updateEditableDraft]
  );

  const handleDraftDurationChange = useCallback(
    (draftId: string, duration: WorkspaceDuration) =>
      updateEditableDraft(draftId, (value: WorkspaceDuration) => ({
        duration: value,
      }))(duration),
    [updateEditableDraft]
  );

  const handleDraftLanguageChange = useCallback(
    (draftId: string, language: WorkspaceLanguage) =>
      updateEditableDraft(draftId, (value: WorkspaceLanguage) => ({
        language: value,
      }))(language),
    [updateEditableDraft]
  );

  const handleDraftCharacterOrientationChange = useCallback(
    (draftId: string, characterOrientation: WorkspaceCharacterOrientation) =>
      updateEditableDraft(
        draftId,
        (value: WorkspaceCharacterOrientation) => ({
          characterOrientation: value,
        })
      )(characterOrientation),
    [updateEditableDraft]
  );

  const handleDraftBackgroundSourceChange = useCallback(
    (draftId: string, backgroundSource: WorkspaceBackgroundSource) =>
      updateEditableDraft(draftId, (value: WorkspaceBackgroundSource) => ({
        backgroundSource: value,
      }))(backgroundSource),
    [updateEditableDraft]
  );

  return {
    handleCreatePromptDraft,
    handleDraftBackgroundSourceChange,
    handleDraftAspectRatioChange,
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
  };
}
