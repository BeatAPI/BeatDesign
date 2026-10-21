import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from './text-nodes';
import type { CanvasDraftCard } from './canvas-types';
import { runDraftGeneration } from './generation-controller';

test('Canvas waits for durable draft flush before precheck and identifies its reviewed source', async () => {
  let card = {
    ...buildTextCard({ id: 'source', name: 'Synthetic draft' }),
    kind: 'generation',
    type: 'image',
    prompt: 'Before flush',
    modelId: 'model',
  } as CanvasDraftCard;
  const calls: string[] = [];
  let finishFlush!: () => void;
  const gate = new Promise<void>((resolve) => {
    finishFlush = resolve;
  });
  const pending = runDraftGeneration({
    draftId: card.id,
    projectId: 'project',
    getCurrentCard: () => card,
    beforeGenerate: async () => {
      calls.push('flush');
      await gate;
      card = { ...card, prompt: 'Saved prompt' };
    },
    buildEffectInput: async (current) => {
      calls.push('build');
      assert.equal(current.prompt, 'Saved prompt');
      return {
        modelId: 'model',
        model: { id: 'model', name: 'Synthetic model' },
        input: { prompt: current.prompt },
      } as never;
    },
    updateDraftCard: (_, patch) => {
      card = { ...card, ...patch };
    },
    createGenerationOutput: () => {
      calls.push('output');
      return 'output';
    },
    updateGenerationOutput: () => {},
    completeGenerationOutput: () => null,
    setStatusMessage: () => {},
    setErrorMessage: () => {},
    getStatusLabel: (value) => value,
    translate: (value) => value,
    notifySuccess: () => {},
    notifyError: () => {},
    precheckEffectImpl: async (payload) => {
      calls.push('precheck');
      const reviewed = payload.generation as
        | { sourceSurface?: string; sourceCardId?: string }
        | undefined;
      assert.equal(reviewed?.sourceSurface, 'canvas');
      assert.equal(reviewed?.sourceCardId, card.id);
      return {
        ok: false,
        data: { error: 'Synthetic stop before generation' },
      } as never;
    },
    generateEffectImpl: async () => {
      throw new Error('Generation must not run.');
    },
    pollEffectUntilCompleteImpl: async () => null,
  });
  assert.deepEqual(calls, ['flush']);
  finishFlush();
  assert.equal(await pending, false);
  assert.deepEqual(calls, ['flush', 'build', 'output', 'precheck']);
});
