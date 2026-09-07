import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';
import {
  buildCanvasGenerationStatusOperations,
  prepareCanvasGenerationSubmission,
  runCanvasGenerationSubmissionOnce,
} from './generation-canvas';

const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');

test('MCP registers Canvas, Generation, and Editor tool groups', () => {
  for (const tool of BEATDESIGN_MCP_TOOL_NAMES) {
    assert.match(source, new RegExp(`['"]${tool}['"]`));
  }
});

test('MCP exposes one Skill catalog through Resources and read-only fallback tools', () => {
  assert.match(source, /server\.registerResource\(/);
  assert.match(source, /BEATDESIGN_SKILL_CATALOG_URI/);
  assert.match(source, /BEATDESIGN_SKILL_RESOURCE_TEMPLATE/);
  assert.match(source, /'bdesign_skill_list'/);
  assert.match(source, /'bdesign_skill_get'/);
});

test('MCP writes use a fixed origin and never expose document replacement', () => {
  assert.match(source, /origin: 'mcp'/);
  assert.doesNotMatch(source, /editor\.replace_document/);
  assert.doesNotMatch(source, /saveProjectSnapshot/);
  assert.doesNotMatch(source, /saveProjectTimeline/);
});

test('external generation requires a reviewed Canvas node before provider submission', () => {
  assert.match(source, /submitAssetFirstGeneration/);
  assert.match(source, /sourceCardId: idSchema/);
  assert.match(source, /prepareCanvasGenerationSubmission/);
  assert.match(source, /const placed = await executeExternalCommand/);
  assert.ok(
    source.indexOf('const placed = await executeExternalCommand') <
      source.indexOf('result = await submitAssetFirstGeneration')
  );
  assert.doesNotMatch(source, /confirmedExternalGeneration/);
  assert.doesNotMatch(source, /CONFIRMATION_REQUIRED/);
  assert.doesNotMatch(source, /generation-confirm/);
});

const reviewedGenerationCard = {
  id: 'generation-reviewed',
  kind: 'generation' as const,
  type: 'video' as const,
  name: 'Reviewed video',
  url: null,
  prompt: 'A reviewed prompt',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'idle' as const,
  error: null,
  modelId: 'video-model',
  aspectRatio: '9:16' as const,
  outputQuality: '720p' as const,
  duration: '10s' as const,
  mode: 'quality' as const,
  variant: 'standard' as const,
  quality: 'standard' as const,
  sourceGenerationId: null,
};

const videoDescriptor = {
  id: 'video-model',
  name: 'Video Model',
  providerId: 'provider',
  kind: 'video' as const,
  available: true,
  parameterSchema: {
    prompt: { type: 'string' },
    aspect_ratio: { type: 'enum' },
    wmDuration: { type: 'enum' },
    wmOutputQuality: { type: 'enum' },
    mode: { type: 'enum' },
  },
  defaultParameters: {},
  referenceSchema: {},
};

test('Canvas generation planning rejects a missing node before creating output', () => {
  assert.throws(
    () =>
      prepareCanvasGenerationSubmission({
        cards: [],
        sourceCardId: reviewedGenerationCard.id,
        submitted: {
          mode: 'video',
          modelId: 'video-model',
          prompt: 'A reviewed prompt',
          references: [],
          parameters: {},
        },
        descriptor: videoDescriptor,
        outputCardId: 'output:test',
        generationRunId: 'run:test',
        capturedAt: '2026-09-06T00:00:00.000Z',
      }),
    /reviewed Canvas generation node is required/
  );
});

test('Canvas generation planning rejects a command that already owns an output node', () => {
  const existing = prepareCanvasGenerationSubmission({
    cards: [reviewedGenerationCard],
    sourceCardId: reviewedGenerationCard.id,
    submitted: {
      mode: 'video',
      modelId: 'video-model',
      prompt: 'A reviewed prompt',
      references: [],
      parameters: {},
    },
    descriptor: videoDescriptor,
    outputCardId: 'output:test',
    generationRunId: 'run:test',
    capturedAt: '2026-09-06T00:00:00.000Z',
  }).outputCard;

  assert.throws(
    () =>
      prepareCanvasGenerationSubmission({
        cards: [reviewedGenerationCard, existing],
        sourceCardId: reviewedGenerationCard.id,
        submitted: {
          mode: 'video',
          modelId: 'video-model',
          prompt: 'A reviewed prompt',
          references: [],
          parameters: {},
        },
        descriptor: videoDescriptor,
        outputCardId: 'output:test',
        generationRunId: 'run:test',
        capturedAt: '2026-09-06T00:00:00.000Z',
      }),
    /already been submitted/
  );
});

test('concurrent retries share one provider submission', async () => {
  let submitCount = 0;
  let finishSubmission: ((value: string) => void) | undefined;
  const submit = () => {
    submitCount += 1;
    return new Promise<string>((resolve) => {
      finishSubmission = resolve;
    });
  };

  const first = runCanvasGenerationSubmissionOnce({
    key: 'project:command',
    submit,
  });
  const retry = runCanvasGenerationSubmissionOnce({
    key: 'project:command',
    submit,
  });
  assert.strictEqual(retry, first);
  assert.equal(submitCount, 1);
  finishSubmission?.('submitted');
  assert.equal(await first, 'submitted');
  assert.equal(await retry, 'submitted');
});

test('Canvas generation planning derives the paid request from the reviewed node', () => {
  const plan = prepareCanvasGenerationSubmission({
    cards: [reviewedGenerationCard],
    sourceCardId: reviewedGenerationCard.id,
    submitted: {
      mode: 'video',
      modelId: 'video-model',
      prompt: 'A reviewed prompt',
      references: [],
      parameters: {
        aspect_ratio: '9:16',
        wmDuration: '10s',
        wmOutputQuality: '720p',
        mode: 'quality',
      },
    },
    descriptor: videoDescriptor,
    outputCardId: 'output:test',
    generationRunId: 'run:test',
    capturedAt: '2026-09-06T00:00:00.000Z',
  });

  assert.deepEqual(plan.request.parameters, {
    aspect_ratio: '9:16',
    wmDuration: '10s',
    wmOutputQuality: '720p',
    mode: 'quality',
  });
  assert.equal(plan.operations[0]?.type, 'upsert_card');
  assert.equal(plan.operations[1]?.type, 'upsert_card');
  assert.equal(plan.operations[2]?.type, 'place_card');
  assert.equal(plan.outputCard.sourceConfigCardId, reviewedGenerationCard.id);
  assert.equal(plan.outputCard.status, 'pending');
});

test('Canvas generation planning rejects request content changed after review', () => {
  assert.throws(
    () =>
      prepareCanvasGenerationSubmission({
        cards: [reviewedGenerationCard],
        sourceCardId: reviewedGenerationCard.id,
        submitted: {
          mode: 'video',
          modelId: 'video-model',
          prompt: 'A different prompt',
          references: [],
          parameters: {},
        },
        descriptor: videoDescriptor,
        outputCardId: 'output:test',
        generationRunId: 'run:test',
        capturedAt: '2026-09-06T00:00:00.000Z',
      }),
    /prompt does not match/
  );
});

test('generation completion writes the result onto its existing output node', () => {
  const plan = prepareCanvasGenerationSubmission({
    cards: [reviewedGenerationCard],
    sourceCardId: reviewedGenerationCard.id,
    submitted: {
      mode: 'video',
      modelId: 'video-model',
      prompt: 'A reviewed prompt',
      references: [],
      parameters: {},
    },
    descriptor: videoDescriptor,
    outputCardId: 'output:test',
    generationRunId: 'run:test',
    capturedAt: '2026-09-06T00:00:00.000Z',
  });
  const operations = buildCanvasGenerationStatusOperations({
    sourceCard: reviewedGenerationCard,
    outputCard: plan.outputCard,
    generationId: 'generation-task',
    status: 'succeeded',
    resultUrl: '/api/app/projects/project/assets/asset-video',
    resultAssetId: 'asset-video',
  });
  const outputOperation = operations[1];
  const sourceOperation = operations[0];
  assert.equal(sourceOperation?.type, 'upsert_card');
  if (sourceOperation?.type === 'upsert_card') {
    assert.equal(sourceOperation.card.url, null);
    assert.equal(sourceOperation.card.pinnedOutputId, 'output:test');
  }
  assert.equal(outputOperation?.type, 'upsert_card');
  if (outputOperation?.type === 'upsert_card') {
    assert.equal(outputOperation.card.id, 'output:test');
    assert.equal(outputOperation.card.sourceGenerationId, 'generation-task');
    assert.equal(outputOperation.card.assetId, 'asset-video');
    assert.equal(outputOperation.card.status, 'succeeded');
  }
});

test('MCP advertises concrete Canvas and Editor operation schemas', () => {
  assert.match(source, /z\.array\(canvasOperationSchema\)/);
  assert.match(source, /z\.array\(editorOperationSchema\)/);
  assert.doesNotMatch(source, /operations:\s*z\.array\(z\.unknown\(\)\)/);
});
