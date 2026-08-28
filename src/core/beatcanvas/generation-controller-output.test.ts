import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CanvasCard,
  CanvasDraftCard,
  CanvasOutputCard,
} from './canvas-types';
import { runDraftGeneration } from './generation-controller';

const makeDraft = (): CanvasDraftCard => ({
  id: 'config:1',
  kind: 'generation',
  type: 'image',
  name: 'Image generation',
  url: null,
  prompt: 'A cinematic portrait',
  referenceCardIds: ['asset:1'],
  workflowTemplateId: null,
  status: 'idle',
  error: null,
  modelId: 'model:1',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
});

test('keeps the generation configuration and completes a separate output card', async () => {
  let draft = makeDraft();
  const localAsset: CanvasCard = {
    ...makeDraft(),
    id: 'asset:1',
    kind: 'asset',
    name: 'Local reference',
    url: '/api/app/projects/project-1/assets/asset-1',
    prompt: '',
    referenceCardIds: [],
  };
  const outputPatches: Array<Partial<CanvasOutputCard>> = [];
  let completedOutputId: string | null = null;
  const callOrder: string[] = [];
  let buildCount = 0;

  const completed = await runDraftGeneration({
    draftId: draft.id,
    projectId: 'project:1',
    getCurrentCard: (cardId) =>
      cardId === localAsset.id ? localAsset : draft,
    buildEffectInput: async (_currentDraft, referenceUrlOverrides) => {
      buildCount += 1;
      callOrder.push(`build:${buildCount}`);
      if (buildCount === 1) {
        assert.equal(referenceUrlOverrides, undefined);
      } else {
        assert.deepEqual(referenceUrlOverrides, {
          'asset:1': 'https://media.beatapi.io/inputs/asset-1.png',
        });
      }
      return ({
        effectId: 1,
        input: {
          prompt: draft.prompt,
          ...(referenceUrlOverrides
            ? { image_urls: [referenceUrlOverrides['asset:1']] }
            : {}),
        },
        model: { name: 'Test model' },
      }) as never;
    },
    getExpectedUploadCount: () => 1,
    updateDraftCard: (_draftId, patch) => {
      draft = { ...draft, ...patch };
    },
    createGenerationOutput: () => 'output:1',
    updateGenerationOutput: (_outputId, patch) => {
      outputPatches.push(patch);
    },
    completeGenerationOutput: ({ outputCardId }) => {
      completedOutputId = outputCardId;
      return outputCardId;
    },
    setStatusMessage: () => undefined,
    setErrorMessage: () => undefined,
    getStatusLabel: (status) => status,
    translate: (key) => key,
    notifySuccess: () => undefined,
    notifyError: () => undefined,
    precheckEffectImpl: async (payload) => {
      assert.equal(payload.expectedUploadCount, 1);
      callOrder.push('precheck');
      return ({
        ok: true,
        data: { uploadIntentToken: 'signed-upload-intent' },
      }) as never;
    },
    prepareAfterPrecheck: async ({ uploadIntentToken }) => {
      assert.equal(uploadIntentToken, 'signed-upload-intent');
      callOrder.push('upload');
      return {
        'asset:1': 'https://media.beatapi.io/inputs/asset-1.png',
      };
    },
    generateEffectImpl: async (payload) => {
      assert.equal(payload.generationIntentToken, 'signed-upload-intent');
      assert.deepEqual(payload.input.image_urls, [
        'https://media.beatapi.io/inputs/asset-1.png',
      ]);
      assert.equal(localAsset.url, '/api/app/projects/project-1/assets/asset-1');
      callOrder.push('generate');
      return ({
        ok: true,
        data: {
          status: 'succeeded',
          output: { resultUrl: 'https://example.com/result.png' },
        },
      }) as never;
    },
    pollEffectUntilCompleteImpl: async () => null,
  });

  assert.equal(completed, true);
  assert.equal(draft.kind, 'generation');
  assert.equal(draft.status, 'idle');
  assert.equal(completedOutputId, 'output:1');
  assert.deepEqual(callOrder, [
    'build:1',
    'precheck',
    'upload',
    'build:2',
    'generate',
  ]);
  assert.deepEqual(
    outputPatches.map((patch) => patch.status),
    ['pending', 'processing', 'processing']
  );
});

test('records a failed run on the output while returning the configuration to idle', async () => {
  let draft = makeDraft();
  let failedOutputPatch: Partial<CanvasOutputCard> | null = null;

  const completed = await runDraftGeneration({
    draftId: draft.id,
    getCurrentCard: () => draft,
    buildEffectInput: async () =>
      ({
        effectId: 1,
        input: { prompt: draft.prompt },
        model: { name: 'Test model' },
      }) as never,
    updateDraftCard: (_draftId, patch) => {
      draft = { ...draft, ...patch };
    },
    createGenerationOutput: () => 'output:failed',
    updateGenerationOutput: (_outputId, patch) => {
      if (patch.status === 'failed') failedOutputPatch = patch;
    },
    completeGenerationOutput: () => null,
    setStatusMessage: () => undefined,
    setErrorMessage: () => undefined,
    getStatusLabel: (status) => status,
    translate: (key) => key,
    notifySuccess: () => undefined,
    notifyError: () => undefined,
    precheckEffectImpl: async () =>
      ({ ok: false, data: { error: 'invalid request' } }) as never,
    generateEffectImpl: async () => ({ ok: false, data: {} }) as never,
    pollEffectUntilCompleteImpl: async () => null,
  });

  assert.equal(completed, false);
  assert.equal(draft.status, 'idle');
  const finalPatch = failedOutputPatch as Partial<CanvasOutputCard> | null;
  assert.ok(finalPatch);
  assert.equal(finalPatch.status, 'failed');
  assert.match(finalPatch.error ?? '', /invalid request/);
});
