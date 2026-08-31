import {
  detectUploadedMediaType,
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
import { uploadLocalProjectAsset } from '@/core/workspace-lib/app/local-project-asset-client';
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
export type UploadActivityIntent = UploadIntent | 'media';

export type UploadMediaMetadata = {
  size?: AssetShapeSize;
  width?: number;
  height?: number;
  durationMs?: number;
};

export function createUploadMediaMetadata({
  width,
  height,
  durationSec,
}: {
  width: number;
  height: number;
  durationSec?: number;
}): UploadMediaMetadata {
  const validWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : undefined;
  const validHeight = Number.isFinite(height) && height > 0 ? Math.round(height) : undefined;
  const validDurationMs =
    Number.isFinite(durationSec) && (durationSec ?? 0) > 0
      ? Math.round((durationSec ?? 0) * 1000)
      : undefined;
  return {
    ...(validWidth && validHeight
      ? {
          width: validWidth,
          height: validHeight,
          size: computeAdaptiveAssetSize(validWidth, validHeight),
        }
      : {}),
    ...(validDurationMs ? { durationMs: validDurationMs } : {}),
  };
}

export type UploadRequest =
  | {
      intent: 'media';
      mode: 'global';
    }
  | {
      intent: UploadIntent;
      mode: 'global';
    }
  | {
      intent: UploadIntent;
      mode: 'reference';
      draftId: string;
    };

export function shouldPersistCanvasImportLocally(_input: {
  request: UploadRequest;
  hasResolvedFrame: boolean;
}) {
  return true;
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

export type PersistedImageUploadForCanvas = PendingImageUploadForCanvas & {
  assetId: string;
  persistedUrl: string;
};

export function materializePersistedImageUploadsToCanvas({
  uploads,
  frames,
  workflowTemplateId,
  insertAssetCard,
}: {
  uploads: PersistedImageUploadForCanvas[];
  frames?: ProjectSnapshotShapeFrame[];
  workflowTemplateId?: string | null;
  insertAssetCard: (input: {
    type: 'image';
    url: string;
    name: string;
    kind: 'asset';
    assetId?: string | null;
    frame?: ProjectSnapshotShapeFrame;
    placementOffsetIndex?: number;
    activateOnInsert?: boolean;
    size?: { w: number; h: number };
    fitMode?: 'cover' | 'contain';
    chromeMode?: 'default' | 'frameless';
    workflowTemplateId?: string | null;
    durationSec?: number | null;
  }) => string | null;
}) {
  const insertedAssetCardIds: string[] = [];

  for (const [index, upload] of uploads.entries()) {
    const assetCardId = insertAssetCard({
      type: 'image',
      url: upload.persistedUrl,
      name: upload.name,
      kind: 'asset',
      assetId: upload.assetId,
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
    assetId?: string | null;
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
  const [uploadIntent, setUploadIntent] =
    useState<UploadActivityIntent | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
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

  const openMediaUploadPicker = useCallback(() => {
    const input = mediaFileInputRef.current;
    if (!input) {
      return;
    }

    input.value = '';
    uploadRequestRef.current = { intent: 'media', mode: 'global' };
    setErrorMessage(null);
    setStatusMessage(studioT('messages.openingMediaPicker'));
    input.click();
  }, [setErrorMessage, setStatusMessage, studioT]);

  function resolveUploadMediaMetadata(
    objectUrl: string,
    intent: UploadIntent
  ): Promise<UploadMediaMetadata> {
    if (intent === 'image') {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve(createUploadMediaMetadata({
            width: img.naturalWidth,
            height: img.naturalHeight,
          }));
        img.onerror = () => resolve({});
        img.src = objectUrl;
      });
    }
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(createUploadMediaMetadata({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSec: video.duration,
        }));
      };
      video.onerror = () => resolve({});
      video.preload = 'metadata';
      video.src = objectUrl;
    });
  }

  const uploadFiles = useCallback(
    async (request: UploadRequest, allFiles: File[]) => {
      setUploadIntent(request.intent);

      if (allFiles.length === 0) {
        uploadRequestRef.current = null;
        setUploadIntent(null);
        setStatusMessage('');
        return;
      }
      const files = request.mode === 'global' ? allFiles : allFiles.slice(0, 1);
      const uploads = files.map((file) => {
        const detectedType =
          request.intent === 'media'
            ? detectUploadedMediaType(file)
            : request.intent;
        return {
          file,
          // Audio enters through the dedicated editor track flow for now.
          intent: detectedType === 'audio' ? null : detectedType,
        };
      });

      for (const upload of uploads) {
        if (!upload.intent) {
          const message = studioT('messages.uploadMediaInvalid', {
            fileName: upload.file.name,
          });
          setErrorMessage(message);
          setUploadIntent(null);
          toast.error(message);
          return;
        }

        const validation =
          upload.intent === 'image'
            ? validateUploadedImageFile(upload.file)
            : validateUploadedVideoFile(upload.file);

        if (!validation.ok) {
          const maxSizeMb = Math.floor(validation.maxBytes / (1024 * 1024));
          const message =
            upload.intent === 'image'
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

        for (const [index, upload] of uploads.entries()) {
          const { file, intent } = upload;
          if (!intent) {
            continue;
          }
          const localObjectUrl = URL.createObjectURL(file);
          const mediaMetadata = await resolveUploadMediaMetadata(localObjectUrl, intent);
          URL.revokeObjectURL(localObjectUrl);
          const persistedAsset = shouldPersistCanvasImportLocally({
            request,
            hasResolvedFrame: Boolean(mediaMetadata.size),
          })
            ? await uploadLocalProjectAsset({
                projectId,
                file,
                width: mediaMetadata.width,
                height: mediaMetadata.height,
                durationMs: mediaMetadata.durationMs,
              })
            : null;
          if (!persistedAsset) {
            throw new Error('Canvas imports must be saved locally before insertion');
          }
          const assetCardId = insertAssetCard({
            type: intent,
            url: persistedAsset.publicUrl,
            name: persistedAsset.filename,
            kind: 'asset',
            assetId: persistedAsset.id,
            anchorCardIds:
              request.mode === 'reference' ? [request.draftId] : undefined,
            placementSide: request.mode === 'reference' ? 'left' : 'right',
            placementOffsetIndex: index,
            activateOnInsert: request.mode !== 'reference',
            ...(mediaMetadata.size ? { size: mediaMetadata.size } : {}),
            ...(mediaMetadata.durationMs
              ? { durationSec: mediaMetadata.durationMs / 1000 }
              : {}),
          });

          if (!assetCardId) {
            continue;
          }

          insertedAssetCardIds.push(assetCardId);

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

        onWorkspaceAssetsMayChange?.();

        if (
          request.mode === 'global' &&
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
      onWorkspaceAssetsMayChange,
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

  const handleMediaUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const request: UploadRequest =
        uploadRequestRef.current?.intent === 'media'
          ? uploadRequestRef.current
          : { intent: 'media', mode: 'global' };
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
        return {};
      }

      const promotions = await promotePendingDraftReferenceUploads({
        draftCard,
        cardsById: canvasCardsRef.current,
        pendingUploadsByCardId: pendingUploadsRef.current,
        projectId,
        generationIntentToken,
      });

      const providerUrlsByCardId: Record<string, string> = {};
      for (const promotion of promotions) {
        providerUrlsByCardId[promotion.cardId] = promotion.uploadResult.url;
        delete pendingUploadsRef.current[promotion.cardId];
        if (promotion.objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(promotion.objectUrl);
        }
      }
      return providerUrlsByCardId;
    },
    [canvasCardsRef, projectId]
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
    async ({
      uploads,
      frames,
      workflowTemplateId,
    }: {
      uploads: PendingImageUploadForCanvas[];
      frames?: ProjectSnapshotShapeFrame[];
      workflowTemplateId?: string | null;
    }) => {
      const persistedUploads = await Promise.all(
        uploads.map(async (upload) => {
          const asset = await uploadLocalProjectAsset({
            projectId,
            file: upload.file,
          });
          if (upload.url.startsWith('blob:')) {
            URL.revokeObjectURL(upload.url);
          }
          return {
            ...upload,
            assetId: asset.id,
            persistedUrl: asset.publicUrl,
          };
        })
      );
      onWorkspaceAssetsMayChange?.();
      return materializePersistedImageUploadsToCanvas({
        uploads: persistedUploads,
        frames,
        workflowTemplateId,
        insertAssetCard,
      });
    },
    [insertAssetCard, onWorkspaceAssetsMayChange, projectId]
  );

  return {
    handleMediaUpload,
    handleUpload,
    mediaFileInputRef,
    imageFileInputRef,
    getPendingUploadCountForDraft,
    materializePendingImageReferences,
    openMediaUploadPicker,
    openUploadPicker,
    promotePendingUploadsForDraft,
    uploadFiles,
    uploadIntent,
    videoFileInputRef,
  };
}
