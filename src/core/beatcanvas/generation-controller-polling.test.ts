import assert from 'node:assert/strict';
import test from 'node:test';

import { pollGenerationUntilComplete } from './generation-controller';

const statusLabels = {
  idle: 'Idle',
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Succeeded',
  failed: 'Failed',
};

test('retries transient status failures and returns the eventual output', async () => {
  let attempts = 0;
  let sleeps = 0;
  const output = { resultUrl: '/api/app/projects/p/assets/video-1' };

  const result = await pollGenerationUntilComplete({
    wmTaskId: 'generation-1',
    effectId: 17,
    statusLabels,
    translate: (key) => key,
    pollIntervalMs: 1,
    sleepImpl: async () => {
      sleeps += 1;
    },
    getEffectStatusImpl: async () => {
      attempts += 1;
      if (attempts <= 2) {
        return {
          ok: false,
          status: 500,
          data: { error: 'Failed to query task status.' },
        };
      }
      return {
        ok: true,
        status: 200,
        data: { status: 'succeeded', output },
      };
    },
  });

  assert.deepEqual(result, output);
  assert.equal(attempts, 3);
  assert.equal(sleeps, 2);
});

test('does not retry a permanent status request error', async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      pollGenerationUntilComplete({
        wmTaskId: 'missing-generation',
        effectId: 17,
        statusLabels,
        translate: (key) => key,
        sleepImpl: async () => undefined,
        getEffectStatusImpl: async () => {
          attempts += 1;
          return {
            ok: false,
            status: 404,
            data: { error: 'Generation not found.' },
          };
        },
      }),
    /Generation not found/
  );
  assert.equal(attempts, 1);
});
