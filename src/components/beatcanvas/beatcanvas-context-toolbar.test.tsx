import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { BeatCanvasContextToolbar } from './beatcanvas-context-toolbar';

test('context toolbar renders an image preview action when a previewable card is selected', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasContextToolbar
      canDownload={true}
      canPreview={true}
      downloadLabel="下载"
      previewLabel="查看"
      onDownload={() => {}}
      onPreview={() => {}}
    />
  );

  assert.match(html, /查看/);
  assert.match(html, /下载/);
});

test('context toolbar can render localized batch download actions', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasContextToolbar
      canDownload={true}
      canPreview={false}
      downloadLabel="Batch download"
      isBatchDownload={true}
      previewLabel={null}
      onDownload={() => {}}
      onPreview={() => {}}
    />
  );

  assert.match(html, /Batch download/);
});
