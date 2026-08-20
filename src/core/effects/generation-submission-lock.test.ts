import assert from 'node:assert/strict';
import test from 'node:test';

import { withGenerationSubmissionLock } from './generation-submission-lock';

test('serializes generation admission checks in one workspace process', async () => {
  const events: string[] = [];
  let releaseFirst: () => void = () => {};
  const firstMayFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = withGenerationSubmissionLock(async () => {
    events.push('first-start');
    await firstMayFinish;
    events.push('first-end');
  });
  const second = withGenerationSubmissionLock(async () => {
    events.push('second-start');
  });

  await Promise.resolve();
  assert.deepEqual(events, ['first-start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);
});
