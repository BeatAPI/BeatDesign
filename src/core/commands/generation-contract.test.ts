import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard } from '@/core/beatcanvas/canvas-types';

import {
  buildAssetFirstReferencesFromCanvasCards,
  GENERATION_REQUEST_VERSION,
  normalizeAssetFirstGenerationRequest,
} from './generation-contract';

const makeAssetCard = (
  id: string,
  assetId: string,
  type: 'image' | 'video' | 'audio'
): CanvasCard => ({
  id,
  assetId,
  kind: 'asset',
  type,
  name: id,
  url: `https://example.com/${id}`,
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: '',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
});

test('generation request v2 rejects the former frame-role contract', () => {
  assert.equal(GENERATION_REQUEST_VERSION, 2);
  assert.throws(() =>
    normalizeAssetFirstGenerationRequest({
      version: 1,
      projectId: 'project-1',
      mode: 'video',
      modelId: 'seedance-2',
      prompt: 'Use @Image1 as the first frame.',
      references: [{ assetId: 'asset-first', role: 'first_frame' }],
    })
  );
});

test('Canvas image references stay generic regardless of attachment order', () => {
  const cards = {
    first: makeAssetCard('first', 'asset-first', 'image'),
    second: makeAssetCard('second', 'asset-second', 'image'),
  };

  assert.deepEqual(
    buildAssetFirstReferencesFromCanvasCards({
      cards,
      referenceCardIds: ['first', 'second'],
    }).map(({ assetId, role }) => ({ assetId, role })),
    [
      { assetId: 'asset-first', role: 'reference' },
      { assetId: 'asset-second', role: 'reference' },
    ]
  );
});

test('non-image references retain only their media-level roles', () => {
  const cards = {
    video: makeAssetCard('video', 'asset-video', 'video'),
    audio: makeAssetCard('audio', 'asset-audio', 'audio'),
  };

  assert.deepEqual(
    buildAssetFirstReferencesFromCanvasCards({
      cards,
      referenceCardIds: ['video', 'audio'],
    }).map(({ assetId, role }) => ({ assetId, role })),
    [
      { assetId: 'asset-video', role: 'source' },
      { assetId: 'asset-audio', role: 'audio_track' },
    ]
  );
});
