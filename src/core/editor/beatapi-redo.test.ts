import assert from 'node:assert/strict';
import test from 'node:test';

import { redoTimelineSelection } from './beatapi-redo';

test('selection redo uploads one derived clip and returns a localized Take', async () => {
  const statuses: string[] = [];
  let generatedInput: Record<string, unknown> | undefined;
  const result = await redoTimelineSelection({
    projectId: 'project-1',
    file: new File(['video'], 'selection.mp4', { type: 'video/mp4' }),
    prompt: '  Make the camera move slowly  ',
    durationSec: 3.6,
    onStatus: (status) => statuses.push(status),
    precheckEffectImpl: (async (payload: {
      generation: { parameters: Record<string, unknown>; references: unknown[] };
    }) => {
      assert.equal(payload.generation.references.length, 1);
      assert.equal(payload.generation.parameters.wmDuration, '4s');
      return {
        ok: true,
        status: 200,
        data: { uploadIntentToken: 'intent-1' },
      };
    }) as never,
    uploadFileImpl: (async () => ({
      id: 'asset-selection',
      publicUrl: '/api/app/projects/project-1/assets/asset-selection',
      key: 'selection.mp4',
    })) as never,
    generateEffectImpl: (async (payload: { generation: Record<string, unknown> }) => {
      generatedInput = payload.generation;
      return {
        ok: true,
        status: 200,
        data: {
          status: 'processing',
          wmTaskId: 'generation-1',
        },
      };
    }) as never,
    getEffectStatusImpl: (async () => ({
      ok: true,
      status: 200,
      data: {
        status: 'succeeded',
        output: {
          stored_result_url: '/api/app/projects/project-1/assets/asset-ai',
          assetIds: ['asset-ai'],
        },
      },
    })) as never,
    sleepImpl: async () => undefined,
  });

  assert.deepEqual(generatedInput?.references, [{ assetId: 'asset-selection', role: 'source' }]);
  assert.equal(result.resultUrl, '/api/app/projects/project-1/assets/asset-ai');
  assert.equal(result.assetId, 'asset-ai');
  assert.equal(result.generationId, 'generation-1');
  assert.deepEqual(statuses, [
    'validating',
    'submitting',
    'processing',
    'succeeded',
  ]);
});

test('selection redo failure does not return or mutate a Take', async () => {
  await assert.rejects(
    redoTimelineSelection({
      projectId: 'project-1',
      file: new File(['video'], 'selection.mp4', { type: 'video/mp4' }),
      prompt: 'Redo',
      uploadFileImpl: (async () => ({ id: 'asset-selection' })) as never,
      durationSec: 5,
      precheckEffectImpl: (async () => ({
        ok: false,
        status: 400,
        data: { error: 'Insufficient credits' },
      })) as never,
    }),
    /Insufficient credits/
  );
});
