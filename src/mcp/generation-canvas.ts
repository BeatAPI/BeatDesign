import {
  getCanvasGenerationMode,
  type CanvasCard,
  type CanvasGenerationCard,
  type CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import {
  buildAssetFirstReferencesFromCanvasCards,
  GENERATION_REQUEST_VERSION,
  type AssetFirstGenerationRequest,
} from '@/core/commands/generation-contract';
import type { CanvasOperation } from '@/core/commands/canvas-commands';
import { resolveWorkspaceEffectProviderModelVariant } from '@/core/effects/effect-registry';
import type { GenerationModelDescriptor } from '@/core/generation-providers';

type GenerationSubmitInput = Omit<
  AssetFirstGenerationRequest,
  'version' | 'projectId'
>;

const inFlightCanvasGenerationSubmissions = new Map<
  string,
  Promise<unknown>
>();

export function runCanvasGenerationSubmissionOnce<T>({
  key,
  submit,
}: {
  key: string;
  submit: () => Promise<T>;
}) {
  const existing = inFlightCanvasGenerationSubmissions.get(key) as
    | Promise<T>
    | undefined;
  if (existing) return existing;

  const pending = submit().finally(() => {
    if (inFlightCanvasGenerationSubmissions.get(key) === pending) {
      inFlightCanvasGenerationSubmissions.delete(key);
    }
  });
  inFlightCanvasGenerationSubmissions.set(key, pending);
  return pending;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasSchemaField = (schema: unknown, field: string) =>
  isRecord(schema) && Object.prototype.hasOwnProperty.call(schema, field);

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const toComparableReferences = (
  references: AssetFirstGenerationRequest['references']
) => references.map(({ assetId, role }) => ({ assetId, role }));

function buildReviewedParameters({
  card,
  descriptor,
  submitted,
}: {
  card: CanvasGenerationCard;
  descriptor: GenerationModelDescriptor;
  submitted: Record<string, unknown>;
}) {
  const schema = descriptor.parameterSchema;
  const reviewed: Record<string, unknown> = {};
  const setIfSupported = (field: string, value: unknown) => {
    if (hasSchemaField(schema, field) && value !== undefined) {
      reviewed[field] = value;
    }
  };

  setIfSupported('aspect_ratio', card.aspectRatio);
  setIfSupported('wmDuration', card.duration);
  setIfSupported('wmOutputQuality', card.outputQuality);
  setIfSupported('quality', card.quality);
  setIfSupported('size', card.quality);
  setIfSupported('mode', card.mode);
  setIfSupported('language', card.language);
  setIfSupported('characterOrientation', card.characterOrientation);
  setIfSupported('backgroundSource', card.backgroundSource);
  setIfSupported(
    'modelVariant',
    resolveWorkspaceEffectProviderModelVariant({
      modelId: card.modelId,
      variant: card.variant,
    })
  );
  setIfSupported('analysis_depth', card.analysisDepth ?? 'standard');

  for (const [field, value] of Object.entries(descriptor.defaultParameters)) {
    if (hasSchemaField(schema, field) && reviewed[field] === undefined) {
      reviewed[field] = value;
    }
  }

  // This value is measured from the referenced video at runtime rather than
  // chosen by the user, so it is the sole accepted non-card parameter.
  if (
    hasSchemaField(schema, 'sourceVideoDurationSeconds') &&
    submitted.sourceVideoDurationSeconds !== undefined
  ) {
    reviewed.sourceVideoDurationSeconds = submitted.sourceVideoDurationSeconds;
  }

  for (const [field, value] of Object.entries(submitted)) {
    if (!(field in reviewed)) {
      throw new Error(
        `Generation parameter ${field} is not represented by the reviewed Canvas node.`
      );
    }
    if (!sameValue(value, reviewed[field])) {
      throw new Error(
        `Generation parameter ${field} does not match the reviewed Canvas node.`
      );
    }
  }

  return reviewed;
}

export function prepareCanvasGenerationSubmission({
  cards,
  sourceCardId,
  submitted,
  descriptor,
  outputCardId,
  generationRunId,
  capturedAt,
}: {
  cards: CanvasCard[];
  sourceCardId: string;
  submitted: GenerationSubmitInput;
  descriptor: GenerationModelDescriptor;
  outputCardId: string;
  generationRunId: string;
  capturedAt: string;
}) {
  const cardsById = Object.fromEntries(cards.map((card) => [card.id, card]));
  const sourceCard = cardsById[sourceCardId];
  if (!sourceCard || sourceCard.kind !== 'generation') {
    throw new Error(
      'A reviewed Canvas generation node is required before submitting a generation.'
    );
  }
  if (cards.some((card) => card.kind === 'output' && card.id === outputCardId)) {
    throw new Error('This generation command has already been submitted.');
  }
  if (sourceCard.status === 'pending' || sourceCard.status === 'processing') {
    throw new Error('This Canvas generation node already has an active task.');
  }
  if (
    cards.some(
      (card) =>
        card.kind === 'output' &&
        card.sourceConfigCardId === sourceCardId &&
        (card.status === 'pending' || card.status === 'processing')
    )
  ) {
    throw new Error('This Canvas generation node already has an active output.');
  }

  const reviewedMode = getCanvasGenerationMode(sourceCard);
  if (submitted.mode !== reviewedMode) {
    throw new Error('Generation mode does not match the reviewed Canvas node.');
  }
  if (submitted.modelId !== sourceCard.modelId) {
    throw new Error('Generation model does not match the reviewed Canvas node.');
  }
  if (submitted.prompt.trim() !== sourceCard.prompt.trim()) {
    throw new Error('Generation prompt does not match the reviewed Canvas node.');
  }
  if (descriptor.id !== sourceCard.modelId || descriptor.kind !== reviewedMode) {
    throw new Error('The reviewed Canvas node uses an unavailable generation model.');
  }

  const references = buildAssetFirstReferencesFromCanvasCards({
    cards: cardsById,
    referenceCardIds: sourceCard.referenceCardIds,
  });
  if (references.length !== sourceCard.referenceCardIds.length) {
    throw new Error(
      'Every reference on the reviewed Canvas node must resolve to a project Asset before submission.'
    );
  }
  if (
    submitted.references.length > 0 &&
    !sameValue(
      toComparableReferences(submitted.references),
      toComparableReferences(references)
    )
  ) {
    throw new Error('Generation references do not match the reviewed Canvas node.');
  }

  const parameters = buildReviewedParameters({
    card: sourceCard,
    descriptor,
    submitted: submitted.parameters,
  });
  const sourceCardPending: CanvasGenerationCard = {
    ...sourceCard,
    status: 'pending',
    error: null,
  };
  const outputCard: CanvasOutputCard = {
    ...sourceCard,
    id: outputCardId,
    assetId: null,
    kind: 'output',
    name: `${descriptor.name} result`,
    url: null,
    resultText: null,
    referenceCardIds: [sourceCard.id],
    status: 'pending',
    error: null,
    sourceGenerationId: null,
    sourceConfigCardId: sourceCard.id,
    generationRunId,
    generationSnapshot: {
      type: sourceCard.type,
      generationMode: sourceCard.generationMode,
      analysisDepth: sourceCard.analysisDepth,
      prompt: sourceCard.prompt,
      referenceCardIds: [...sourceCard.referenceCardIds],
      workflowTemplateId: sourceCard.workflowTemplateId,
      modelId: sourceCard.modelId,
      aspectRatio: sourceCard.aspectRatio,
      outputQuality: sourceCard.outputQuality,
      duration: sourceCard.duration,
      language: sourceCard.language,
      mode: sourceCard.mode,
      variant: sourceCard.variant,
      quality: sourceCard.quality,
      characterOrientation: sourceCard.characterOrientation,
      backgroundSource: sourceCard.backgroundSource,
      resultText: sourceCard.resultText ?? null,
      capturedAt,
    },
  };

  return {
    sourceCard,
    outputCard,
    request: {
      version: GENERATION_REQUEST_VERSION,
      mode: reviewedMode,
      modelId: sourceCard.modelId,
      prompt: sourceCard.prompt,
      references,
      parameters,
    },
    operations: [
      { type: 'upsert_card', card: sourceCardPending },
      { type: 'upsert_card', card: outputCard },
      {
        type: 'place_card',
        cardId: outputCard.id,
        sourceCardIds: [sourceCard.id],
        side: 'right',
      },
    ] satisfies CanvasOperation[],
  };
}

export function buildCanvasGenerationStatusOperations({
  sourceCard,
  outputCard,
  generationId,
  status,
  resultUrl = null,
  resultText = null,
  resultAssetId = null,
  error = null,
}: {
  sourceCard: CanvasGenerationCard;
  outputCard: CanvasOutputCard;
  generationId: string | null;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  resultUrl?: string | null;
  resultText?: string | null;
  resultAssetId?: string | null;
  error?: string | null;
}): CanvasOperation[] {
  const terminal = status === 'succeeded' || status === 'failed';
  const succeeded = status === 'succeeded';
  return [
    {
      type: 'upsert_card',
      card: {
        ...sourceCard,
        ...(succeeded ? { pinnedOutputId: outputCard.id } : {}),
        status: terminal ? 'idle' : status,
        error: null,
      },
    },
    {
      type: 'upsert_card',
      card: {
        ...outputCard,
        assetId: succeeded ? resultAssetId : outputCard.assetId,
        url: succeeded ? resultUrl : outputCard.url,
        resultText: succeeded ? resultText : outputCard.resultText,
        status,
        error: status === 'failed' ? error : null,
        sourceGenerationId: generationId,
      },
    },
  ];
}
