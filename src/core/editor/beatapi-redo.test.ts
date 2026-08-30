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
      expectedUploadCount?: number;
      input: Record<string, unknown>;
    }) => {
      assert.equal(payload.expectedUploadCount, 1);
      assert.equal(payload.input.wmDuration, '4s');
      return {
        ok: true,
        status: 200,
        data: { uploadIntentToken: 'intent-1' },
      };
    }) as never,
    uploadFileImpl: (async () => ({
      url: 'https://media.beatapi.io/inputs/selection.mp4',
      key: 'selection.mp4',
    })) as never,
    generateEffectImpl: (async (payload: { input: Record<string, unknown> }) => {
      generatedInput = payload.input;
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

  assert.deepEqual(generatedInput?.video_urls, [
    'https://media.beatapi.io/inputs/selection.mp4',
  ]);
  assert.equal(result.resultUrl, '/api/app/projects/project-1/assets/asset-ai');
  assert.equal(result.assetId, 'asset-ai');
  assert.equal(result.generationId, 'generation-1');
  assert.deepEqual(statuses, [
    'validating',
    'uploading',
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
