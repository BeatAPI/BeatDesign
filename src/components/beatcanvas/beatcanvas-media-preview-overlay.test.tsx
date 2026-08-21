import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { BeatCanvasMediaPreviewOverlay } from './beatcanvas-media-preview-overlay';

test('media preview overlay renders the selected image at a larger size', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasMediaPreviewOverlay
      media={{
        type: 'image',
        url: 'blob:local-product-preview',
        title: 'Product reference',
      }}
      closeLabel="关闭"
      onClose={() => {}}
    />
  );

  assert.match(html, /blob:local-product-preview/);
  assert.match(html, /Product reference/);
  assert.match(html, /关闭/);
  assert.match(html, /max-h-\[calc\(100vh-140px\)\]/);
});

test('media preview overlay renders video playback controls', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasMediaPreviewOverlay
      media={{
        type: 'video',
        url: 'blob:local-video-preview',
        title: 'Motion reference',
      }}
      closeLabel="Close"
      onClose={() => {}}
    />
  );

  assert.match(html, /<video/);
  assert.match(html, /blob:local-video-preview/);
  assert.match(html, /controls=""/);
  assert.match(html, /Motion reference/);
});
