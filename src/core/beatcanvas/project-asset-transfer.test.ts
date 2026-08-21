import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROJECT_ASSET_DRAG_MIME,
  getProjectAssetCardSize,
  isProjectAssetTransferType,
  parseProjectAssetTransfer,
} from './project-asset-transfer';

test('parses a project image transfer and keeps its project scope', () => {
  const parsed = parseProjectAssetTransfer(
    JSON.stringify({
      id: 'asset-1',
      projectId: 'project-1',
      publicUrl: '/uploads/image.webp',
      mediaType: 'image',
      filename: 'image.webp',
      width: 1080,
      height: 1920,
      durationMs: null,
      createdAt: '2026-08-21T00:00:00.000Z',
    })
  );

  assert.equal(parsed?.id, 'asset-1');
  assert.equal(parsed?.projectId, 'project-1');
  assert.equal(parsed?.mediaType, 'image');
});

test('rejects malformed and unsupported project asset transfers', () => {
  assert.equal(parseProjectAssetTransfer('not-json'), null);
  assert.equal(
    parseProjectAssetTransfer(
      JSON.stringify({
        id: 'asset-1',
        projectId: 'project-1',
        publicUrl: '/uploads/audio.mp3',
        mediaType: 'audio',
        width: null,
        height: null,
      })
    ),
    null
  );
});

test('recognizes the custom drag type and preserves media aspect ratio', () => {
  assert.equal(isProjectAssetTransferType([PROJECT_ASSET_DRAG_MIME]), true);
  assert.deepEqual(
    getProjectAssetCardSize({
      id: 'asset-portrait',
      publicUrl: '/portrait.webp',
      width: 1080,
      height: 1920,
      createdAt: '2026-08-21T00:00:00.000Z',
    }),
    { w: 203, h: 360 }
  );
});
