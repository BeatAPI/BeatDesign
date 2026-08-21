import assert from 'node:assert/strict';
import test from 'node:test';

import {
  materializePendingImageUploadsToCanvas,
  shouldUploadImmediatelyAfterCanvasInsert,
  type UploadRequest,
} from './use-beatcanvas-upload-actions';

test('does not upload image selections immediately after canvas insertion', () => {
  const imageRequests: UploadRequest[] = [
    { intent: 'image', mode: 'global' },
    { intent: 'image', mode: 'reference', draftId: 'draft-1' },
  ];

  for (const request of imageRequests) {
    assert.equal(
      shouldUploadImmediatelyAfterCanvasInsert({
        request,
        hasResolvedFrame: true,
      }),
      false,
      `${request.mode} image uploads should stay local until generation`
    );
  }
});

test('does not change non-image uploads through the image-only policy', () => {
  assert.equal(
    shouldUploadImmediatelyAfterCanvasInsert({
      request: { intent: 'video', mode: 'global' },
      hasResolvedFrame: true,
    }),
    false
  );
  assert.equal(
    shouldUploadImmediatelyAfterCanvasInsert({
      request: { intent: 'media', mode: 'global' },
      hasResolvedFrame: true,
    }),
    false
  );
});

test('materializes local image references without uploading them', () => {
  const file = new File(['image-bytes'], 'product.png', { type: 'image/png' });
  const pendingUploadsByCardId: Record<
    string,
    { file: File; objectUrl: string }
  > = {};
  const inserts: unknown[] = [];

  const cardIds = materializePendingImageUploadsToCanvas({
    uploads: [
      {
        file,
        name: 'product.png',
        url: 'blob:local-product-preview',
        size: { w: 1200, h: 900 },
      },
    ],
    frames: [{ x: 10, y: 20, w: 132, h: 112 }],
    pendingUploadsByCardId,
    insertAssetCard: (input) => {
      inserts.push(input);
      return `card-${inserts.length}`;
    },
  });

  assert.deepEqual(cardIds, ['card-1']);
  assert.deepEqual(pendingUploadsByCardId, {
    'card-1': {
      file,
      objectUrl: 'blob:local-product-preview',
    },
  });
  assert.deepEqual(inserts, [
    {
      type: 'image',
      url: 'blob:local-product-preview',
      name: 'product.png',
      kind: 'asset',
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
