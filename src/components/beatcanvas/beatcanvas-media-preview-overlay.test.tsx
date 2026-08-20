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
