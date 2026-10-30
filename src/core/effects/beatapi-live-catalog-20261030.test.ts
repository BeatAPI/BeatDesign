import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBeatApiTaskRequest } from '@/core/adapters/beatapi-adapter';
import { listGenerationModelDescriptors, validateGenerationModelInput } from '@/core/generation-providers/model-catalog';
import { getWorkspaceMediaSchema } from './workspace-media';

const reference = 'https://media.beatapi.io/reference.png';
test('new live models are discoverable and retired models are excluded', () => {
  const ids = new Set(listGenerationModelDescriptors().map((model) => model.id));
  for (const id of ['nano-banana-2.1', 'seedream-5-lite', 'qwen-image-2.1', 'minimax-h3-fast', 'minimax-h3-normal', 'kling-v4']) assert.ok(ids.has(id), id);
  for (const id of ['happyhorse-1.0', 'happyhorse-1.1', 'kling-2.6-motion-control', 'kling-3-motion-control']) assert.ok(!ids.has(id), id);
});
test('new image models map references and supported resolutions', () => {
  for (const [model, limit, resolution] of [['nano-banana-2.1', 14, '1K'], ['seedream-5-lite', 6, '2K'], ['qwen-image-2.1', 10, '1K']] as const) {
    assert.equal(getWorkspaceMediaSchema(model)?.image.max, limit);
    const body = buildBeatApiTaskRequest({ effectType: 2, model, input: { prompt: 'A product', image_urls: [reference] } }).body;
    assert.equal(body.model, model);
    assert.equal(body.resolution, resolution);
    assert.deepEqual(body.images, [reference]);
  }
});
test('new video models map references, quality and Kling mentions', () => {
  for (const [model, quality] of [['minimax-h3-fast', '2k'], ['minimax-h3-normal', '1080p'], ['kling-v4', '1080p']] as const) {
    const body = buildBeatApiTaskRequest({ effectType: 1, model, input: { prompt: 'Move @Image1', image_urls: [reference], wmOutputQuality: quality, wmDuration: '5s' } }).body;
    assert.equal(body.model, model);
    assert.deepEqual(body.reference_images, [reference]);
    assert.equal(body.resolution, quality === '2k' ? '2K' : quality);
    if (model === 'kling-v4') assert.equal(body.prompt, 'Move @image_1');
  }
  assert.throws(() => buildBeatApiTaskRequest({ effectType: 1, model: 'minimax-h3-normal', input: { prompt: 'x', audio_urls: ['https://media.beatapi.io/a.mp3'] } }), /audio reference/);
  assert.throws(() => buildBeatApiTaskRequest({ effectType: 1, model: 'wan-3.0', input: { prompt: 'x', image_urls: [reference], video_urls: ['https://media.beatapi.io/v.mp4'] } }), /cannot be combined/);
  assert.throws(() => validateGenerationModelInput({ modelId: 'wan-3.0-prime', input: { prompt: 'x', wmDuration: '2s' } }), /Unsupported wmDuration/);
});
