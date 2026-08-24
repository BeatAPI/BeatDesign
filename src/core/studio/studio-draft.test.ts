import assert from 'node:assert/strict';
import test from 'node:test';

import type { ProjectGenerationItem } from '@/core/effects/project-generations';

import { applyStudioHistoryItem } from './studio-draft';
import { getStudioModels } from './studio-runtime';

const item = (
  overrides: Partial<ProjectGenerationItem> = {}
): ProjectGenerationItem => ({
  id: 'gen-1',
  status: 'succeeded',
  prompt: 'A coastal village',
  modelId: 'gpt-image-2',
  modelName: 'GPT Image 2',
  mediaType: 'image',
  resultUrl: 'https://media.beatapi.io/out.png',
  resultText: null,
  paramsLabel: '9:16 · 1K',
  aspectRatio: '9:16',
  outputQuality: '1k',
  mode: null,
  duration: null,
  referenceImages: ['https://media.beatapi.io/ref.png'],
  referenceVideos: [],
  error: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

test('reuses a history item back into the studio composer draft', () => {
  const next = applyStudioHistoryItem({
    item: item(),
    imageModels: getStudioModels('image'),
    videoModels: getStudioModels('video'),
  });

  assert.equal(next.media, 'image');
  assert.equal(next.draft.prompt, 'A coastal village');
  assert.equal(next.draft.modelId, 'gpt-image-2');
  assert.equal(next.draft.aspectRatio, '9:16');
  assert.deepEqual(next.referenceUrls, ['https://media.beatapi.io/ref.png']);
});
