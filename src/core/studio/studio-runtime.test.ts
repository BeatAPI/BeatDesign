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
  assert.equal(input.generationType, undefined);
});

test('passes Veo quality mode and resolution through the shared studio input', () => {
  const veo = getStudioModels('video').find((item) => item.id === 'veo-3.1');
  assert.ok(veo);
  assert.deepEqual(veo.modeOptions, ['quality', 'fast', 'lite']);
  assert.deepEqual(
    buildStudioEffectInput({
      media: 'video',
      model: veo,
      prompt: 'Coastal sunrise',
      aspectRatio: '16:9',
      mode: 'lite',
      outputQuality: '4k',
      duration: '8s',
    }),
    {
      prompt: 'Coastal sunrise',
      aspect_ratio: '16:9',
      wmDuration: '8s',
      mode: 'lite',
      wmOutputQuality: '4k',
    }
  );
});
