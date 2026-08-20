import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStudioEffectInput,
  getStudioModels,
} from './studio-runtime';

test('builds a text-to-image request from the shared effects registry', () => {
  const model = getStudioModels('image').find((item) => item.id === 'gpt-image-2');
  assert.ok(model);
  assert.deepEqual(
    buildStudioEffectInput({
      media: 'image',
      model,
      prompt: 'A premium perfume product shot',
      aspectRatio: '1:1',
    }),
    {
      prompt: 'A premium perfume product shot',
      aspect_ratio: '1:1',
      wmOutputQuality: '1k',
    }
  );
});

test('builds a text-to-video request without inventing a second backend', () => {
  const model = getStudioModels('video')[0];
  assert.ok(model);
  const input = buildStudioEffectInput({
    media: 'video',
    model,
    prompt: 'Slow cinematic camera move',
    aspectRatio: '16:9',
  });
  assert.equal(input.prompt, 'Slow cinematic camera move');
  assert.equal(input.generationType, 'TEXT_2_VIDEO');
});
