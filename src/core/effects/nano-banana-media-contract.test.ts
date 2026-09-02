import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBeatApiTaskRequest } from '@/core/adapters/beatapi-adapter';

import { getRegisteredEffectById } from './registered-effects';
import { getWorkspaceMediaSchema } from './workspace-media';

test('Nano Banana accepts up to ten reference images from Canvas through BeatAPI', () => {
  const mediaSchema = getWorkspaceMediaSchema('nano-banana');
  const inputSchema = getRegisteredEffectById(5)?.inputSchema as Record<
    string,
    unknown
  >;
  const images = Array.from(
    { length: 10 },
    (_, index) => `https://media.example/reference-${index + 1}.png`
  );

  assert.equal(mediaSchema?.image.max, 10);
  assert.equal(mediaSchema?.image.slots.length, 10);
  assert.ok(
    mediaSchema?.image.slots.every((slot) => slot.kind === 'reference-image')
  );
  assert.ok(inputSchema.image_urls);

  const request = buildBeatApiTaskRequest({
    effectType: 2,
    model: 'nano-banana',
    input: {
      prompt: 'Keep the subject and apply the references',
      image_urls: images,
      aspect_ratio: '9:16',
    },
  });

  assert.deepEqual(request.body.images, images);
});

test('Nano Banana 2 variants expose the upstream image contract', () => {
  for (const [model, effectId] of [
    ['nano-banana-2', 25],
    ['nano-banana-2-lite', 26],
  ] as const) {
    const mediaSchema = getWorkspaceMediaSchema(model);
    const effect = getRegisteredEffectById(effectId);
    const inputSchema = effect?.inputSchema as Record<string, unknown>;

    assert.equal(mediaSchema?.image.max, 10);
    assert.equal(mediaSchema?.image.slots.length, 10);
    assert.ok(inputSchema.image_urls);
    assert.equal(effect?.model, model);
  }

  const nanoBanana2 = buildBeatApiTaskRequest({
    effectType: 2,
    model: 'nano-banana-2',
    input: {
      prompt: 'Create a product image',
      wmOutputQuality: '4k',
    },
  });
  assert.equal(nanoBanana2.body.resolution, '4K');

  const nanoBanana2Lite = buildBeatApiTaskRequest({
    effectType: 2,
    model: 'nano-banana-2-lite',
    input: {
      prompt: 'Create a product image',
    },
  });
  assert.equal('resolution' in nanoBanana2Lite.body, false);
});
