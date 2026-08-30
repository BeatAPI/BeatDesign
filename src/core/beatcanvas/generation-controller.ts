import {
  type EffectClientStatus,
  type EffectMetadata,
  generateEffect as defaultGenerateEffect,
  getEffectStatus as defaultGetEffectStatus,
  precheckEffect as defaultPrecheckEffect,
  resolveWmTaskId,
} from '@/core/effects/client-api';
import {
  getWorkspaceEffectReferenceInputDefaults,
  resolveWorkspaceEffectProviderModelVariant,
} from '@/core/effects/effect-registry';
import { resolveOutputMedia } from '@/core/effects/output-media';
import {
  getGenerationPromptConstraints,
  getGenerationPromptMaxChars,
  validateGenerationPrompt,
} from '@/core/effects/validation';
import {
  resolveVideoAnalysisText,
  VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS,
  VIDEO_ANALYSIS_EFFECT_ID,
  VIDEO_ANALYSIS_MODEL_ID,
} from '@/core/effects/video-analysis';
import {
  findWorkspaceModelOption,
  type WorkspaceModelOption,
} from '@/core/effects/workspace-models';
import {
  buildAssetFirstReferencesFromCanvasCards,
  normalizeAssetFirstGenerationRequest,
} from '@/core/commands/generation-contract';
import {
  type CanvasCard,
  type CanvasCardMediaType,
  type CanvasCardStatus,
  type CanvasDraftCard,
  type CanvasOutputCard,
  isCanvasAnalysisCard,
  isCanvasDraftCard,
} from '@/core/beatcanvas/canvas-types';
import {
  type WorkflowReferenceCard,
  resolveReferencePayload,
} from '@/core/beatcanvas/canvas-workflows';
import { isDraftBusyStatus } from '@/core/beatcanvas/composer';
import { isLocalWorkspaceMediaUrl } from '@/core/beatcanvas/local-references';

export type StudioJobStatus = CanvasCardStatus;

export type RuntimeMessages = {
  missingVideoUrl: string;
  readVideoDurationFailed: string;
  videoMetadataLoadFailed: string;
};

type TranslateFn = (
  key: string,
  values?: Record<string, string | number>
) => string;

type GenerationFailureStage =
  | 'precheck'
  | 'request'
  | 'provider'
  | 'polling'
  | 'output'
  | 'storage';

class GenerationFailure extends Error {
  stage: GenerationFailureStage;

  constructor(stage: GenerationFailureStage, message: string) {
    super(message);
    this.name = 'GenerationFailure';
    this.stage = stage;
  }
}

const getGenerationFailureStageLabel = (
  stage: GenerationFailureStage,
  translate: TranslateFn
) => {
  const label = translate(`messages.generationFailureStages.${stage}`);

  return label === `messages.generationFailureStages.${stage}` ? stage : label;
};

const formatGenerationFailure = ({
  error,
  fallbackStage,
  translate,
}: {
  error: unknown;
  fallbackStage: GenerationFailureStage;
  translate: TranslateFn;
}) => {
  const stage =
    error instanceof GenerationFailure ? error.stage : fallbackStage;
  const message =
    error instanceof Error
      ? error.message
      : translate('messages.generationFailed');

  return `${getGenerationFailureStageLabel(stage, translate)}：${message}`;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const hasInputSchemaField = (schema: unknown, field: string) =>
  isRecord(schema) && Object.prototype.hasOwnProperty.call(schema, field);

export const getJobStatusLabel = (
  status: StudioJobStatus,
  labels: Record<StudioJobStatus, string>
) => labels[status] ?? labels.idle;

export const loadVideoDurationSeconds = (
  url: string,
  messages: RuntimeMessages
) =>
  new Promise<number>((resolve, reject) => {
    if (!url) {
      reject(new Error(messages.missingVideoUrl));
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const durationSeconds = video.duration;
      cleanup();
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        reject(new Error(messages.readVideoDurationFailed));
        return;
      }
      resolve(durationSeconds);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(messages.videoMetadataLoadFailed));
    };

    video.src = url;
  });

export const toWorkflowReferenceCard = (
  card: CanvasCard
): WorkflowReferenceCard => {
  if (card.type !== 'image' && card.type !== 'video') {
    throw new Error('Only image and video cards can be generation references');
  }
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    url: card.url ?? '',
    role: 'asset',
  };
};

export const getSelectableModel = (
  models: WorkspaceModelOption[],
  modelId: string | null | undefined
) =>
  findWorkspaceModelOption(models, modelId) ??
  models.find((model) => model.available !== false) ??
  null;

const getVideoAnalysisModel = (
  depth: CanvasDraftCard['analysisDepth'] = 'standard'
): WorkspaceModelOption => ({
  id: VIDEO_ANALYSIS_MODEL_ID,
  name:
    depth === 'deep'
      ? 'Video Analysis Pro'
      : 'Video Analysis Standard',
  effectId: VIDEO_ANALYSIS_EFFECT_ID,
  uploadPath: 'effects/video-analysis',
  imageBucketName: 'video',
  supportsSourceVideo: true,
  maxSourceVideos: 1,
});

type BuildGenerationEffectInputParams = {
  draftCard: CanvasDraftCard;
  canvasCards: Record<string, CanvasCard>;
  referenceUrlOverrides?: Record<string, string>;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  metadataMap: Record<number, EffectMetadata>;
  runtimeMessages: RuntimeMessages;
  translate: TranslateFn;
  notify?: (message: string) => void;
  loadVideoDurationSecondsImpl?: typeof loadVideoDurationSeconds;
};

export const buildGenerationEffectInput = async ({
  draftCard,
  canvasCards,
  referenceUrlOverrides = {},
  imageModels,
  videoModels,
  metadataMap,
  runtimeMessages,
  translate,
  notify,
  loadVideoDurationSecondsImpl = loadVideoDurationSeconds,
}: BuildGenerationEffectInputParams) => {
  if (isCanvasAnalysisCard(draftCard)) {
    const promptValidation = validateGenerationPrompt(draftCard.prompt, {
      required: true,
      maxChars: getGenerationPromptMaxChars({
        modelId: VIDEO_ANALYSIS_MODEL_ID,
      }),
    });
    if (!promptValidation.ok) {
      throw new Error(
        promptValidation.code === 'PROMPT_TOO_LONG'
          ? translate('messages.promptTooLong', {
              maxChars: promptValidation.maxChars,
            })
          : translate('messages.promptRequired')
      );
    }

    const videoReferences = draftCard.referenceCardIds
      .map((cardId) => canvasCards[cardId])
      .filter(
        (card): card is CanvasCard =>
          Boolean(card?.url) && card.type === 'video'
      );
    if (videoReferences.length !== 1) {
      throw new Error(translate('messages.analysisVideoRequired'));
    }

    const videoReference = videoReferences[0];
    const videoUrl = videoReference
      ? referenceUrlOverrides[videoReference.id] ?? videoReference.url
      : null;
    const input: Record<string, unknown> = {
      prompt: promptValidation.trimmedPrompt,
      analysis_depth: draftCard.analysisDepth ?? 'standard',
      max_output_tokens: VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS,
    };
    if (videoUrl && !isLocalWorkspaceMediaUrl(videoUrl)) {
      input.video_url = videoUrl;
    }

    return {
      effectId: VIDEO_ANALYSIS_EFFECT_ID,
      input,
      model: getVideoAnalysisModel(draftCard.analysisDepth),
    };
  }

  const models = draftCard.type === 'image' ? imageModels : videoModels;
  const model = getSelectableModel(models, draftCard.modelId);
  if (!model) {
    throw new Error(translate('messages.noAvailableModel'));
  }

  const metadata = metadataMap[model.effectId];
  if (!metadata) {
    throw new Error(translate('messages.metadataLoading'));
  }

  const promptValidation = validateGenerationPrompt(
    draftCard.prompt,
    getGenerationPromptConstraints({ modelId: model.id })
  );
  if (!promptValidation.ok) {
    throw new Error(
      promptValidation.code === 'PROMPT_TOO_LONG'
        ? translate('messages.promptTooLong', {
            maxChars: promptValidation.maxChars,
          })
        : translate('messages.promptRequired')
    );
  }

  const pendingPlannedReferences = draftCard.referenceCardIds
    .map((cardId) => canvasCards[cardId])
    .filter(
      (card): card is CanvasDraftCard =>
        isCanvasDraftCard(card) && !card.url
    );
  if (
    pendingPlannedReferences.some((referenceCard) => referenceCard.type === 'image')
  ) {
    throw new Error(translate('messages.imageReferencesPending'));
  }

  const referenceCards = draftCard.referenceCardIds
    .map((cardId) => canvasCards[cardId])
    .flatMap((card) => {
      if (
        !card?.url ||
        (card.type !== 'image' && card.type !== 'video')
      ) return [];
      const providerUrl = referenceUrlOverrides[card.id] ?? card.url;
      if (isLocalWorkspaceMediaUrl(providerUrl)) return [];
      return [
        {
          ...toWorkflowReferenceCard(card),
          url: providerUrl,
        },
      ];
    });

  const referencePayload = resolveReferencePayload({
    cards: referenceCards,
    taskType: draftCard.type,
  });

  const input: Record<string, unknown> = {
    prompt: promptValidation.trimmedPrompt,
  };
  const hasVideoReference = referenceCards.some(
    (card) => card.type === 'video'
  );
  const primaryReferenceType: CanvasCardMediaType | null = hasVideoReference
    ? 'video'
    : referencePayload.imageUrls.length > 0
      ? 'image'
      : null;

  if (draftCard.type === 'image') {
    if (hasInputSchemaField(metadata.inputSchema, 'aspect_ratio')) {
      input.aspect_ratio = draftCard.aspectRatio;
    }
    if (hasInputSchemaField(metadata.inputSchema, 'wmOutputQuality')) {
      input.wmOutputQuality = draftCard.outputQuality;
    }
    if (hasInputSchemaField(metadata.inputSchema, 'quality')) {
      input.quality = draftCard.quality;
    }
    if (referencePayload.imageUrls.length > 0) {
      input.image_urls = referencePayload.imageUrls;
    }
    if (referencePayload.videoUrls.length > 0) {
      notify?.(translate('messages.imageModelOnlySupportsImageReference'));
    }

    return {
      effectId: model.effectId,
      input,
      model,
    };
  }

  if (hasInputSchemaField(metadata.inputSchema, 'aspect_ratio')) {
    input.aspect_ratio = draftCard.aspectRatio;
  }
  if (hasInputSchemaField(metadata.inputSchema, 'wmDuration')) {
    input.wmDuration = draftCard.duration;
  }
  if (
    draftCard.language &&
    hasInputSchemaField(metadata.inputSchema, 'language')
  ) {
    input.language = draftCard.language;
  }
  if (hasInputSchemaField(metadata.inputSchema, 'mode')) {
    input.mode = draftCard.mode;
  }
  if (hasInputSchemaField(metadata.inputSchema, 'modelVariant')) {
    input.modelVariant = resolveWorkspaceEffectProviderModelVariant({
      modelId: model.id,
      variant: draftCard.variant,
    });
  }
  if (hasInputSchemaField(metadata.inputSchema, 'size')) {
    input.size = draftCard.quality;
  }
  if (hasInputSchemaField(metadata.inputSchema, 'wmOutputQuality')) {
    input.wmOutputQuality = draftCard.outputQuality;
  }

  if (referencePayload.imageUrls.length > 0) {
    input.image_urls = referencePayload.imageUrls;
  }

  if (
    referencePayload.imageUrls.length > 1 &&
    hasInputSchemaField(metadata.inputSchema, 'last_frame')
  ) {
    input.last_frame =
      referencePayload.imageUrls[referencePayload.imageUrls.length - 1];
  }

  if (referencePayload.videoUrls.length > 0) {
    if (!hasInputSchemaField(metadata.inputSchema, 'video_urls')) {
      throw new Error(translate('messages.videoContinuationUnsupported'));
    }

    input.video_urls = referencePayload.videoUrls;

    if (
      hasInputSchemaField(metadata.inputSchema, 'sourceVideoDurationSeconds')
    ) {
      input.sourceVideoDurationSeconds = await loadVideoDurationSecondsImpl(
        draftCard.referenceCardIds
          .map((cardId) => canvasCards[cardId])
          .find((card) => card?.type === 'video' && card.url)?.url ??
          referencePayload.videoUrls[0],
        runtimeMessages
      );
    }
  }

  const referenceInputDefaults = getWorkspaceEffectReferenceInputDefaults({
    modelId: model.id,
    referenceType: primaryReferenceType,
  });
  if (referenceInputDefaults) {
    if (hasInputSchemaField(metadata.inputSchema, 'characterOrientation')) {
      input.characterOrientation =
        draftCard.characterOrientation ??
        referenceInputDefaults.characterOrientation;
    }
    if (hasInputSchemaField(metadata.inputSchema, 'backgroundSource')) {
      input.backgroundSource =
        draftCard.backgroundSource ?? referenceInputDefaults.backgroundSource;
    }
  }

  return {
    effectId: model.effectId,
    input,
    model,
  };
};

type PollGenerationUntilCompleteParams = {
  wmTaskId: string;
  effectId: number;
  statusLabels: Record<StudioJobStatus, string>;
  translate: TranslateFn;
  onStatus?: (status: StudioJobStatus, message: string) => void;
  getEffectStatusImpl?: typeof defaultGetEffectStatus;
  sleepImpl?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  pollIntervalMs?: number;
};

export const pollGenerationUntilComplete = async ({
  wmTaskId,
  effectId,
  statusLabels,
  translate,
  onStatus,
  getEffectStatusImpl = defaultGetEffectStatus,
  sleepImpl = sleep,
  maxAttempts = 120,
  pollIntervalMs = 5000,
}: PollGenerationUntilCompleteParams) => {
  let lastOutput: unknown = null;

  for (let count = 0; count < maxAttempts; count += 1) {
    const response = await getEffectStatusImpl({
      wmTaskId,
      effectId,
      syncProvider: 1,
    });
    if (!response.ok) {
      throw new GenerationFailure(
        'polling',
        response.data.error || translate('messages.statusRequestFailed')
      );
    }

    const nextStatus = (response.data.status ??
      'processing') as EffectClientStatus;
    lastOutput = response.data.output ?? lastOutput;
    onStatus?.(nextStatus, getJobStatusLabel(nextStatus, statusLabels));

    if (nextStatus === 'succeeded') {
      return response.data.output ?? lastOutput;
    }

    if (nextStatus === 'failed') {
      throw new GenerationFailure(
        'provider',
        response.data.error || translate('messages.generationFailed')
      );
    }

    await sleepImpl(pollIntervalMs);
  }

  throw new GenerationFailure('polling', translate('messages.taskTimeout'));
};

type BuildGenerationEffectInputResult = Awaited<
  ReturnType<typeof buildGenerationEffectInput>
>;

type RunDraftGenerationParams = {
  draftId: string;
  projectId?: string;
  getCurrentCard: (draftId: string) => CanvasCard | null | undefined;
  buildEffectInput: (
    draftCard: CanvasDraftCard,
    referenceUrlOverrides?: Record<string, string>
  ) => Promise<BuildGenerationEffectInputResult>;
  getExpectedUploadCount?: (draftCard: CanvasDraftCard) => number;
  updateDraftCard: (draftId: string, patch: Partial<CanvasDraftCard>) => void;
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
  suppressResultFocus?: boolean;
  setStatusMessage: (message: string) => void;
  setErrorMessage: (message: string | null) => void;
  getStatusLabel: (status: StudioJobStatus) => string;
  translate: TranslateFn;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  precheckEffectImpl?: typeof defaultPrecheckEffect;
  prepareAfterPrecheck?: (precheck: {
    uploadIntentToken?: string;
  }) => Promise<Record<string, string> | void>;
  generateEffectImpl?: typeof defaultGenerateEffect;
  pollEffectUntilCompleteImpl: (params: {
    wmTaskId: string;
    effectId: number;
    onStatus?: (status: StudioJobStatus, message: string) => void;
  }) => Promise<unknown>;
};

export const runDraftGeneration = async ({
  draftId,
  projectId,
  getCurrentCard,
  buildEffectInput,
  getExpectedUploadCount,
  updateDraftCard,
  createGenerationOutput,
  updateGenerationOutput,
  completeGenerationOutput,
  suppressResultFocus = false,
  setStatusMessage,
  setErrorMessage,
  getStatusLabel,
  translate,
  notifySuccess,
  notifyError,
  precheckEffectImpl = defaultPrecheckEffect,
  prepareAfterPrecheck,
  generateEffectImpl = defaultGenerateEffect,
  pollEffectUntilCompleteImpl,
}: RunDraftGenerationParams) => {
  const currentCard = getCurrentCard(draftId);
  if (
    !isCanvasDraftCard(currentCard) ||
    isDraftBusyStatus(currentCard.status)
  ) {
    return false;
  }

  let outputCardId: string | null = null;

  try {
    const initialRequest = await buildEffectInput(currentCard);
    const { effectId, model } = initialRequest;
    let input = initialRequest.input;
    const expectedUploadCount = getExpectedUploadCount?.(currentCard) ?? 0;
    const outputName = `${model.name} result`;
    outputCardId = createGenerationOutput({
      draftCard: currentCard,
      name: outputName,
      suppressFocus: suppressResultFocus,
    });
    if (!outputCardId) {
      throw new GenerationFailure(
        'storage',
        translate('messages.generationFailed')
      );
    }
    updateDraftCard(draftId, {
      status: 'pending',
      error: null,
    });
    updateGenerationOutput(outputCardId, {
      status: 'pending',
      error: null,
    });
    setErrorMessage(null);
    setStatusMessage(translate('messages.validatingRequest'));

    const precheckResponse = await precheckEffectImpl({
      effectId,
      input,
      projectId,
      expectedUploadCount,
    });
    if (!precheckResponse.ok) {
      throw new GenerationFailure(
        'precheck',
        precheckResponse.data.error ||
          translate('messages.requestValidationFailed')
      );
    }
    const generationIntentToken = precheckResponse.data.uploadIntentToken;
    if (!generationIntentToken) {
      throw new GenerationFailure(
        'precheck',
        translate('messages.requestValidationFailed')
      );
    }

    let referenceUrlOverrides: Record<string, string> = {};
    if (prepareAfterPrecheck) {
      try {
        referenceUrlOverrides =
          (await prepareAfterPrecheck({
            uploadIntentToken: generationIntentToken,
          })) ?? {};
      } catch (error) {
        throw new GenerationFailure(
          'storage',
          error instanceof Error
            ? error.message
            : translate('messages.uploadFailed')
        );
      }
      const preparedCard = getCurrentCard(draftId);
      if (!isCanvasDraftCard(preparedCard)) {
        throw new GenerationFailure(
          'storage',
          translate('messages.generationFailed')
        );
      }
      const preparedRequest = await buildEffectInput(
        preparedCard,
        referenceUrlOverrides
      );
      if (preparedRequest.effectId !== effectId) {
        throw new GenerationFailure(
          'precheck',
          translate('messages.requestValidationFailed')
        );
      }
      const unresolvedLocalReference = preparedCard.referenceCardIds.some(
        (cardId) => {
          const card = getCurrentCard(cardId);
          return (
            typeof card?.url === 'string' &&
            isLocalWorkspaceMediaUrl(card.url) &&
            (!referenceUrlOverrides[cardId] ||
              isLocalWorkspaceMediaUrl(referenceUrlOverrides[cardId]))
          );
        }
      );
      if (unresolvedLocalReference) {
        throw new GenerationFailure(
          'storage',
          translate('messages.localReferenceExpired')
        );
      }
      input = preparedRequest.input;
    }

    updateDraftCard(draftId, {
      status: 'processing',
    });
    updateGenerationOutput(outputCardId, {
      status: 'processing',
    });
    setStatusMessage(translate('messages.submittingRequest'));

    const submittedCard = getCurrentCard(draftId);
    const generation =
      projectId && isCanvasDraftCard(submittedCard)
        ? normalizeAssetFirstGenerationRequest({
            version: 1,
            projectId,
            mode: isCanvasAnalysisCard(submittedCard)
              ? 'analysis'
              : submittedCard.type,
            modelId: submittedCard.modelId || model.id,
            prompt: submittedCard.prompt,
            references: buildAssetFirstReferencesFromCanvasCards({
              cards: Object.fromEntries(
                submittedCard.referenceCardIds.flatMap((cardId) => {
                  const card = getCurrentCard(cardId);
                  return card ? [[cardId, card]] : [];
                })
              ),
              referenceCardIds: submittedCard.referenceCardIds,
              mode: isCanvasAnalysisCard(submittedCard)
                ? 'analysis'
                : submittedCard.type,
              deliveryUrlsByCardId: referenceUrlOverrides,
            }),
            parameters: Object.fromEntries(
              Object.entries(input).filter(
                ([key]) =>
                  ![
                    'prompt',
                    'image_url',
                    'image_urls',
                    'video_url',
                    'video_urls',
                    'audio_url',
                    'audio_urls',
                    'first_frame',
                    'last_frame',
                  ].includes(key)
              )
            ),
          })
        : undefined;

    const response = await generateEffectImpl({
      effectId,
      input,
      projectId,
      generationIntentToken,
      generation,
    });
    if (!response.ok) {
      throw new GenerationFailure(
        'request',
        response.data.error || translate('messages.generationRequestFailed')
      );
    }

    let output = response.data.output;
    const initialStatus = (response.data.status ??
      'processing') as EffectClientStatus;
    updateDraftCard(draftId, {
      status: initialStatus === 'succeeded' ? 'processing' : initialStatus,
    });
    updateGenerationOutput(outputCardId, {
      status: initialStatus === 'succeeded' ? 'processing' : initialStatus,
    });
    setStatusMessage(getStatusLabel(initialStatus));

    if (initialStatus === 'failed') {
      throw new GenerationFailure(
        'provider',
        response.data.error || translate('messages.generationFailed')
      );
    }

    const wmTaskId = resolveWmTaskId({
      wmTaskId: response.data.wmTaskId,
      output: response.data.output,
    });

    // Persist the task id before polling so an in-flight generation can be
    // resumed from the saved snapshot after a page reload.
    if (wmTaskId) {
      updateGenerationOutput(outputCardId, {
        sourceGenerationId: wmTaskId,
      });
    }

    if (
      wmTaskId &&
      (initialStatus === 'pending' || initialStatus === 'processing')
    ) {
      try {
        output = await pollEffectUntilCompleteImpl({
          wmTaskId,
          effectId,
          onStatus: (status, message) => {
            updateDraftCard(draftId, {
              status,
            });
            if (outputCardId) {
              updateGenerationOutput(outputCardId, {
                status,
              });
            }
            setStatusMessage(message);
          },
        });
      } catch (error) {
        if (error instanceof GenerationFailure) {
          throw error;
        }

        throw new GenerationFailure(
          'polling',
          error instanceof Error
            ? error.message
            : translate('messages.generationFailed')
        );
      }
    }

    const isAnalysis = isCanvasAnalysisCard(currentCard);
    const resultText = isAnalysis ? resolveVideoAnalysisText(output) : null;
    const resolvedMedia = isAnalysis ? null : resolveOutputMedia(output);
    if (isAnalysis ? !resultText : !resolvedMedia?.resultUrl) {
      throw new GenerationFailure(
        'output',
        translate(
          isAnalysis
            ? 'messages.analysisCompletedWithoutText'
            : 'messages.generationFailed'
        )
      );
    }

    const latestDraftCard = getCurrentCard(draftId);
    if (!isCanvasDraftCard(latestDraftCard)) {
      throw new GenerationFailure(
        'storage',
        translate('messages.generationFailed')
      );
    }

    const completedShapeId = completeGenerationOutput({
      outputCardId,
      draftCard: latestDraftCard,
      url: resolvedMedia?.resultUrl ?? null,
      resultText,
      name: outputName,
      sourceGenerationId: wmTaskId ?? null,
      suppressFocus: suppressResultFocus,
    });
    if (!completedShapeId) {
      throw new GenerationFailure(
        'storage',
        translate('messages.generationFailed')
      );
    }

    updateDraftCard(draftId, {
      status: 'idle',
      error: null,
    });

    setStatusMessage(translate('messages.taskCompleted'));
    notifySuccess(translate('messages.generationSuccess'));
    return true;
  } catch (error) {
    const message = formatGenerationFailure({
      error,
      fallbackStage: 'request',
      translate,
    });
    if (outputCardId) {
      updateGenerationOutput(outputCardId, {
        status: 'failed',
        error: message,
      });
      updateDraftCard(draftId, {
        status: 'idle',
        error: null,
      });
    } else {
      updateDraftCard(draftId, {
        status: 'failed',
        error: message,
      });
    }
    setErrorMessage(message);
    setStatusMessage(message);
    notifyError(message);
    return false;
  }
};
