import assert from 'node:assert/strict';
import test from 'node:test';

import {
  materializePersistedImageUploadsToCanvas,
  shouldPersistCanvasImportLocally,
  type UploadRequest,
} from './use-beatcanvas-upload-actions';

test('persists image selections immediately after canvas insertion', () => {
  const imageRequests: UploadRequest[] = [
    { intent: 'image', mode: 'global' },
    { intent: 'image', mode: 'reference', draftId: 'draft-1' },
  ];

  for (const request of imageRequests) {
    assert.equal(
      shouldPersistCanvasImportLocally({
        request,
        hasResolvedFrame: true,
      }),
      true,
      `${request.mode} image uploads should be durable before insertion`
    );
  }
});

test('persists video and mixed-media selections immediately too', () => {
  assert.equal(
    shouldPersistCanvasImportLocally({
      request: { intent: 'video', mode: 'global' },
      hasResolvedFrame: true,
    }),
    true
  );
  assert.equal(
    shouldPersistCanvasImportLocally({
      request: { intent: 'media', mode: 'global' },
      hasResolvedFrame: true,
    }),
    true
  );
});

test('materializes image references only from durable local asset URLs', () => {
  const file = new File(['image-bytes'], 'product.png', { type: 'image/png' });
  const inserts: unknown[] = [];

  const cardIds = materializePersistedImageUploadsToCanvas({
    uploads: [
      {
        file,
        name: 'product.png',
        url: 'blob:local-product-preview',
        assetId: 'asset-1',
        persistedUrl: '/api/app/projects/project-1/assets/asset-1',
        size: { w: 1200, h: 900 },
      },
    ],
    frames: [{ x: 10, y: 20, w: 132, h: 112 }],
    insertAssetCard: (input) => {
      inserts.push(input);
      return `card-${inserts.length}`;
    },
  });

  assert.deepEqual(cardIds, ['card-1']);
  assert.deepEqual(inserts, [
    {
      type: 'image',
      url: '/api/app/projects/project-1/assets/asset-1',
      name: 'product.png',
      kind: 'asset',
      assetId: 'asset-1',
      frame: { x: 10, y: 20, w: 132, h: 112 },
      placementOffsetIndex: 0,
      activateOnInsert: false,
      fitMode: 'contain',
      chromeMode: 'frameless',
      workflowTemplateId: undefined,
      size: { w: 1200, h: 900 },
    },
  ]);
});
