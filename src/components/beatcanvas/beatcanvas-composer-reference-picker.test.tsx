import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import type { CanvasLabels } from './beatcanvas-front-layer-context';
import { BeatCanvasComposerReferencePicker } from './beatcanvas-composer-reference-picker';

const labels = {
  uploadImageLabel: 'Upload image',
  uploadVideoLabel: 'Upload video',
} as CanvasLabels;

test('row variant renders an icon-only compact reference upload control', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerReferencePicker
      activeDraftId="draft-1"
      isDraftBusy={false}
      isOpen={false}
      labels={labels}
      onOpenChange={() => {}}
      onOpenReferencePicker={() => {}}
      options={[{ intent: 'image', remaining: 3 }]}
      primaryIntent="image"
      variant="row"
    />
  );

  assert.match(html, /aria-label="Upload image"/);
  assert.match(html, /h-7 w-7/);
  assert.match(html, /border-dashed/);
  assert.doesNotMatch(html, />Upload image</);
  assert.doesNotMatch(html, />3</);
  assert.doesNotMatch(html, /h-8 w-8/);
});

test('open picker lists attached and canvas reference cards', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerReferencePicker
      activeDraftId="draft-1"
      canvasReferenceCards={[
        {
          id: 'asset-2',
          name: 'Beach',
          type: 'image',
          thumbnailUrl: 'https://example.com/beach.webp',
        },
      ]}
      currentReferenceCards={[
        {
          id: 'asset-1',
          name: 'Sunset',
          type: 'image',
          thumbnailUrl: 'https://example.com/sunset.webp',
        },
      ]}
      isDraftBusy={false}
      isOpen={true}
      labels={{
        ...labels,
        currentReferencesLabel: 'Attached',
        fromCanvasLabel: 'From canvas',
        removeReferenceLabel: 'Remove reference',
      }}
      onAttachCanvasReference={() => {}}
      onOpenChange={() => {}}
      onOpenReferencePicker={() => {}}
      onRemoveCanvasReference={() => {}}
      options={[{ intent: 'image', remaining: 3 }]}
      primaryIntent="image"
    />
  );

  assert.match(html, /Attached/);
  assert.match(html, /Sunset/);
  assert.match(html, /From canvas/);
  assert.match(html, /Beach/);
  assert.match(html, /aria-label="Remove reference"/);
});
