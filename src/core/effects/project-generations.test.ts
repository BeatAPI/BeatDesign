import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toChronologicalProjectGenerationItems,
  toProjectGenerationItem,
} from './project-generations';

test('maps a stored generation onto the studio feed card', () => {
  const item = toProjectGenerationItem({
    id: 'gen-1',
    status: 'succeeded',
    submittedPrompt: 'A quiet coastal village',
    effectId: 1,
    input: {
      model: 'veo-3.1',
      mode: 'fast',
      aspect_ratio: '9:16',
      wmOutputQuality: '1k',
      image_urls: ['https://media.beatapi.io/inputs/ref.png'],
    },
    output: { result_url: 'https://media.beatapi.io/outputs/gen-1.mp4' },
    error: null,
    createdAt: new Date('2026-08-22T00:00:00.000Z'),
  });

  assert.equal(item.modelId, 'veo-3.1');
  assert.equal(item.modelName, 'Veo 3.1');
  assert.equal(item.mediaType, 'video');
  assert.equal(item.resultUrl, 'https://media.beatapi.io/outputs/gen-1.mp4');
  assert.equal(item.prompt, 'A quiet coastal village');
  assert.equal(item.paramsLabel, 'Fast · 9:16 · 1K');
  assert.equal(item.aspectRatio, '9:16');
  assert.deepEqual(item.referenceImages, [
    'https://media.beatapi.io/inputs/ref.png',
  ]);
});

test('keeps the latest limited generations in chronological feed order', () => {
  const row = (id: string, createdAt: string) => ({
    id,
    status: 'succeeded',
    submittedPrompt: null,
    effectId: 1,
    input: {},
    output: null,
    error: null,
    createdAt,
  });

  const items = toChronologicalProjectGenerationItems([
    row('newest', '2026-08-23T02:00:00.000Z'),
    row('older', '2026-08-23T01:00:00.000Z'),
  ]);

  assert.deepEqual(items.map((item) => item.id), ['older', 'newest']);
});
