'use client';

import {
  validateUploadedImageFile,
  validateUploadedVideoFile,
} from '@/core/effects/validation';
import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type { ProjectSnapshotShapeFrame } from '@/core/projects/project-snapshot';
import type {
  CanvasCard,
  CanvasCardMediaType,
  CanvasDraftCard,
} from '@/core/beatcanvas/canvas-types';
import { isCanvasDraftCard } from '@/core/beatcanvas/canvas-types';
import {
  appendUniqueReferenceCardId,
  getDraftReferencePickerOptions,
  isDraftBusyStatus,
} from '@/core/beatcanvas/composer';
import { getSelectableModel } from '@/core/beatcanvas/generation-controller';
import {
  getPendingDraftReferenceUploadCount,
  type PendingLocalReferenceUpload,
  promotePendingDraftReferenceUploads,
} from '@/core/beatcanvas/local-references';
import {
  type AssetShapeSize,
  computeAdaptiveAssetSize,
} from '@/core/beatcanvas/studio/project-asset-runtime';
import type {
  ChangeEvent,
  MutableRefObject,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type PlacementSide = 'left' | 'right';

type TranslateFn = (
  key: string,
  values?: Record<string, string | number>
) => string;

export type UploadIntent = CanvasCardMediaType;

export type UploadRequest =
  | {
      intent: UploadIntent;
      mode: 'global';
    }
  | {
      intent: UploadIntent;
      mode: 'reference';
      draftId: string;
    };

export function shouldUploadImmediatelyAfterCanvasInsert(_input: {
  request: UploadRequest;
  hasResolvedFrame: boolean;
}) {
  return false;
}

export type PendingImageUploadForCanvas = {
  file: File;
  name: string;
  url: string;
  size?: {
    w: number;
    h: number;
  };
};

export function materializePendingImageUploadsToCanvas({
  uploads,
  frames,
  workflowTemplateId,
  pendingUploadsByCardId,
  insertAssetCard,
}: {
  uploads: PendingImageUploadForCanvas[];
  frames?: ProjectSnapshotShapeFrame[];
  workflowTemplateId?: string | null;
  pendingUploadsByCardId: Record<string, PendingLocalReferenceUpload>;
  insertAssetCard: (input: {
    type: 'image';
    url: string;
    name: string;
    kind: 'asset';
    frame?: ProjectSnapshotShapeFrame;
    placementOffsetIndex?: number;
    activateOnInsert?: boolean;
    size?: { w: number; h: number };
    fitMode?: 'cover' | 'contain';
    chromeMode?: 'default' | 'frameless';
    workflowTemplateId?: string | null;
  }) => string | null;
}) {
  const insertedAssetCardIds: string[] = [];

  for (const [index, upload] of uploads.entries()) {
    const assetCardId = insertAssetCard({
      type: 'image',
      url: upload.url,
      name: upload.name,
      kind: 'asset',
      frame: frames?.[index],
      placementOffsetIndex: index,
      activateOnInsert: false,
      fitMode: 'contain',
      chromeMode: 'frameless',
      workflowTemplateId,
      ...(upload.size ? { size: upload.size } : {}),
    });

    if (!assetCardId) {
      continue;
    }

    insertedAssetCardIds.push(assetCardId);
    pendingUploadsByCardId[assetCardId] = {
      file: upload.file,
      objectUrl: upload.url,
    };
  }

  return insertedAssetCardIds;
}

export function useBeatCanvasUploadActions({
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
  onWorkspaceAssetsMayChange,
}: {
  projectId: string;
  studioT: TranslateFn;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  canvasCardsRef: MutableRefObject<Record<string, CanvasCard>>;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string) => void;
  createConnectorBetweenCards: (
    sourceCardId: string,
    targetCardId: string
  ) => void;
  createDraftCard: (input: {
    taskType: UploadIntent;
    prompt: string;
    referenceCardIds: string[];
    placementSide?: PlacementSide;
    connectReferences?: boolean;
  }) => string | null;
  focusShape: (shapeId: string) => void;
  focusShapes: (shapeIds: string[]) => void;
  handleSelectShape: (shapeId: string | null) => void;
  insertAssetCard: (input: {
    type: UploadIntent;
    url: string;
    name: string;
    kind: 'asset';
    anchorCardIds?: string[];
    placementSide?: PlacementSide;
    frame?: ProjectSnapshotShapeFrame;
    placementOffsetIndex?: number;
    activateOnInsert?: boolean;
    size?: { w: number; h: number };
    fitMode?: 'cover' | 'contain';
    chromeMode?: 'default' | 'frameless';
    workflowTemplateId?: string | null;
  }) => string | null;
  updateCanvasCard: (
    cardId: string,
    updater: Partial<CanvasCard> | ((current: CanvasCard) => CanvasCard)
  ) => void;
  updateDraftCard: (
    draftId: string,
    updater:
      | Partial<CanvasDraftCard>
      | ((current: CanvasDraftCard) => CanvasDraftCard)
  ) => void;
  setActiveComposerCardId: (cardId: string | null) => void;
  onWorkspaceAssetsMayChange?: () => void;
}) {
  const [uploadIntent, setUploadIntent] = useState<UploadIntent | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRequestRef = useRef<UploadRequest | null>(null);
  const statusMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingUploadsRef = useRef<Record<string, PendingLocalReferenceUpload>>(
    {}
  );

  const setTemporaryStatusMessage = useCallback(
    (message: string, duration = 3000) => {
      if (statusMessageTimeoutRef.current) {
        clearTimeout(statusMessageTimeoutRef.current);
        statusMessageTimeoutRef.current = null;
      }

      setStatusMessage(message);
      statusMessageTimeoutRef.current = setTimeout(() => {
        setStatusMessage('');
        statusMessageTimeoutRef.current = null;
      }, duration);
    },
    [setStatusMessage]
  );

  useEffect(
    () => () => {
      if (statusMessageTimeoutRef.current) {
        clearTimeout(statusMessageTimeoutRef.current);
      }
    },
    []
  );

  const openUploadPicker = useCallback(
    (request: UploadRequest) => {
      if (request.mode === 'reference') {
        const draftCard = canvasCardsRef.current[request.draftId];
        if (
          !isCanvasDraftCard(draftCard) ||
          isDraftBusyStatus(draftCard.status)
        ) {
          return;
        }

        const model =
          draftCard.type === 'image'
            ? getSelectableModel(imageModels, draftCard.modelId)
            : getSelectableModel(videoModels, draftCard.modelId);
        const canUploadReference = getDraftReferencePickerOptions({
          draftCard,
          cards: canvasCardsRef.current,
          model,
        }).some((option) => option.intent === request.intent);

        if (!canUploadReference) {
          return;
        }
      }

      const input =
        request.intent === 'image'
          ? imageFileInputRef.current
          : videoFileInputRef.current;
      if (!input) {
        return;
      }

      input.value = '';
      uploadRequestRef.current = request;
      setErrorMessage(null);
      setStatusMessage(
        studioT(
          request.intent === 'image'
            ? 'messages.openingImagePicker'
            : 'messages.openingVideoPicker'
        )
      );

      input.click();
    },
    [
      canvasCardsRef,
      imageModels,
      setErrorMessage,
      setStatusMessage,
      studioT,
      videoModels,
    ]
  );

  function resolveUploadNaturalSize(
    objectUrl: string,
    intent: UploadIntent
  ): Promise<AssetShapeSize | undefined> {
    if (intent === 'image') {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve(
            computeAdaptiveAssetSize(img.naturalWidth, img.naturalHeight)
          );
        img.onerror = () => resolve(undefined);
        img.src = objectUrl;
      });
    }
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(computeAdaptiveAssetSize(video.videoWidth, video.videoHeight));
      };
      video.onerror = () => resolve(undefined);
      video.preload = 'metadata';
      video.src = objectUrl;
    });
  }

  const uploadFiles = useCallback(
    async (request: UploadRequest, allFiles: File[]) => {
      const intent = request.intent;
      setUploadIntent(intent);

      if (allFiles.length === 0) {
        uploadRequestRef.current = null;
        setUploadIntent(null);
        setStatusMessage('');
        return;
      }
      const files =
        request.mode === 'global' && intent === 'image'
          ? allFiles
          : allFiles.slice(0, 1);

      for (const file of files) {
        const validation =
          intent === 'image'
            ? validateUploadedImageFile(file)
            : validateUploadedVideoFile(file);

        if (!validation.ok) {
          const maxSizeMb = Math.floor(validation.maxBytes / (1024 * 1024));
          const message =
            intent === 'image'
              ? studioT('messages.uploadImageInvalid', { maxSizeMb })
              : studioT('messages.uploadVideoInvalid', { maxSizeMb });
          setErrorMessage(message);
          setUploadIntent(null);
          toast.error(message);
          return;
        }
      }

      setErrorMessage(null);
      setStatusMessage(studioT('messages.uploading'));

      try {
        const insertedAssetCardIds: string[] = [];

        for (const [index, file] of files.entries()) {
          const localObjectUrl = URL.createObjectURL(file);

          const naturalSize = await resolveUploadNaturalSize(
            localObjectUrl,
            intent
          );
          const assetCardId = insertAssetCard({
            type: intent,
            url: localObjectUrl,
            name: file.name,
            kind: 'asset',
            anchorCardIds:
              request.mode === 'reference' ? [request.draftId] : undefined,
            placementSide: request.mode === 'reference' ? 'left' : 'right',
            placementOffsetIndex:
              request.mode === 'global' && intent === 'image' ? index : 0,
            activateOnInsert: request.mode !== 'reference',
            ...(naturalSize ? { size: naturalSize } : {}),
          });

          if (!assetCardId) {
            URL.revokeObjectURL(localObjectUrl);
            continue;
          }

          insertedAssetCardIds.push(assetCardId);
          pendingUploadsRef.current[assetCardId] = {
            file,
            objectUrl: localObjectUrl,
          };

          if (request.mode === 'reference') {
            const currentDraft = canvasCardsRef.current[request.draftId];

            if (
              isCanvasDraftCard(currentDraft) &&
              !isDraftBusyStatus(currentDraft.status)
            ) {
              const model =
                currentDraft.type === 'image'
                  ? getSelectableModel(imageModels, currentDraft.modelId)
                  : getSelectableModel(videoModels, currentDraft.modelId);
              const canAttachReference = getDraftReferencePickerOptions({
                draftCard: currentDraft,
                cards: canvasCardsRef.current,
                model,
              }).some((option) => option.intent === intent);

              if (canAttachReference) {
                updateDraftCard(request.draftId, (current) => {
                  if (isDraftBusyStatus(current.status)) {
                    return current;
                  }

                  return {
                    ...current,
                    referenceCardIds: appendUniqueReferenceCardId(
                      current.referenceCardIds,
                      assetCardId
                    ),
                    status: 'idle',
                    error: null,
                  };
                });
                createConnectorBetweenCards(assetCardId, request.draftId);
                setActiveComposerCardId(request.draftId);
                handleSelectShape(request.draftId);
                focusShapes([assetCardId, request.draftId]);
              } else {
                handleSelectShape(assetCardId);
                focusShape(assetCardId);
              }
            } else {
              handleSelectShape(assetCardId);
              focusShape(assetCardId);
            }
          } else {
            handleSelectShape(assetCardId);
            focusShape(assetCardId);
          }
        }

        if (insertedAssetCardIds.length === 0) {
          const message = studioT('messages.uploadCanvasInsertFailed');
          setErrorMessage(message);
          setStatusMessage(message);
          toast.error(message);
          return;
        }

        if (
          request.mode === 'global' &&
          intent === 'image' &&
          insertedAssetCardIds.length > 1
        ) {
          handleSelectShape(
            insertedAssetCardIds[insertedAssetCardIds.length - 1]
          );
          focusShapes(insertedAssetCardIds);
        }

        setTemporaryStatusMessage(studioT('messages.uploadSuccess'));
        toast.success(studioT('messages.uploadSuccess'), { duration: 3000 });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : studioT('messages.uploadFailed');
        setErrorMessage(message);
        setStatusMessage(message);
        toast.error(message);
      } finally {
        uploadRequestRef.current = null;
        setUploadIntent(null);
      }
    },
    [
      canvasCardsRef,
      createConnectorBetweenCards,
      focusShape,
      focusShapes,
      handleSelectShape,
      imageModels,
      insertAssetCard,
      projectId,
      setActiveComposerCardId,
      setErrorMessage,
      setStatusMessage,
      setTemporaryStatusMessage,
      studioT,
      updateDraftCard,
      videoModels,
    ]
  );

  const handleUpload = useCallback(
    (intent: UploadIntent) => async (event: ChangeEvent<HTMLInputElement>) => {
      const request =
        uploadRequestRef.current && uploadRequestRef.current.intent === intent
          ? uploadRequestRef.current
          : {
              intent,
              mode: 'global' as const,
            };

      const allFiles = Array.from(event.target.files ?? []);
      event.target.value = '';
      await uploadFiles(request, allFiles);
    },
    [uploadFiles]
  );

  const promotePendingUploadsForDraft = useCallback(
    async (draftId: string, generationIntentToken: string) => {
      const draftCard = canvasCardsRef.current[draftId];
      if (!isCanvasDraftCard(draftCard)) {
        return;
      }

      const promotions = await promotePendingDraftReferenceUploads({
        draftCard,
        cardsById: canvasCardsRef.current,
        pendingUploadsByCardId: pendingUploadsRef.current,
        projectId,
        generationIntentToken,
      });

      for (const promotion of promotions) {
        updateCanvasCard(promotion.cardId, (current) => ({
          ...current,
          name: current.name || promotion.uploadResult.key,
          url: promotion.uploadResult.url,
        }));
        delete pendingUploadsRef.current[promotion.cardId];
        if (promotion.objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(promotion.objectUrl);
        }
      }
    },
    [canvasCardsRef, projectId, updateCanvasCard]
  );

  const getPendingUploadCountForDraft = useCallback(
    (draftId: string) => {
      const draftCard = canvasCardsRef.current[draftId];
      if (!isCanvasDraftCard(draftCard)) return 0;
      return getPendingDraftReferenceUploadCount({
        draftCard,
        cardsById: canvasCardsRef.current,
        pendingUploadsByCardId: pendingUploadsRef.current,
      });
    },
    [canvasCardsRef]
  );

  const materializePendingImageReferences = useCallback(
    ({
      uploads,
      frames,
      workflowTemplateId,
    }: {
      uploads: PendingImageUploadForCanvas[];
      frames?: ProjectSnapshotShapeFrame[];
      workflowTemplateId?: string | null;
    }) =>
      materializePendingImageUploadsToCanvas({
        uploads,
        frames,
        workflowTemplateId,
        pendingUploadsByCardId: pendingUploadsRef.current,
        insertAssetCard,
      }),
    [insertAssetCard]
  );

  return {
    handleUpload,
    imageFileInputRef,
    getPendingUploadCountForDraft,
    materializePendingImageReferences,
    openUploadPicker,
    promotePendingUploadsForDraft,
    uploadFiles,
    uploadIntent,
    videoFileInputRef,
  };
}
