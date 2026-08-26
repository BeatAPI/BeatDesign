import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getGenerationPromptConstraints,
  getGenerationPromptMaxChars,
} from './validation';

test('prompt constraints follow the public BeatAPI model contract', () => {
  assert.deepEqual(getGenerationPromptConstraints({ modelId: 'seedance-2' }), {
    required: true,
    maxChars: 5000,
  });
  assert.deepEqual(
    getGenerationPromptConstraints({ modelId: 'kling-3-motion-control' }),
    { required: false, maxChars: 2500 }
  );
  assert.equal(
    getGenerationPromptMaxChars({ modelId: 'video-analysis' }),
    12000
  );
  assert.equal(
    getGenerationPromptMaxChars({ modelId: 'grok-imagine-video-1.5' }),
    4096
  );
});
