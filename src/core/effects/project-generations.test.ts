import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toChronologicalProjectGenerationItems,
  toProjectGenerationItem,
} from './project-generations';
import { VIDEO_ANALYSIS_EFFECT_ID } from './video-analysis';

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

test('maps video analysis text, depth, and source video onto the studio feed', () => {
  const item = toProjectGenerationItem({
    id: 'analysis-1',
    status: 'succeeded',
    submittedPrompt: 'Find continuity issues',
    effectId: VIDEO_ANALYSIS_EFFECT_ID,
    input: {
      video_url: 'https://media.beatapi.io/inputs/review.mp4',
      analysis_depth: 'deep',
      max_output_tokens: 4096,
    },
    output: { analysis_text: 'One continuity issue at 00:12.' },
    error: null,
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
  });

  assert.equal(item.mediaType, 'analysis');
  assert.equal(item.modelName, 'Video Analysis Pro');
  assert.equal(item.resultText, 'One continuity issue at 00:12.');
  assert.equal(item.paramsLabel, null);
  assert.deepEqual(item.referenceVideos, [
    'https://media.beatapi.io/inputs/review.mp4',
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
