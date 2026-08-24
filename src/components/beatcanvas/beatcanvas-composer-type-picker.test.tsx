import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import type { CanvasLabels } from './beatcanvas-front-layer-context';
import { BeatCanvasComposerTypePicker } from './beatcanvas-composer-type-picker';

const labels = {
  imageTitle: 'Image',
  videoTitle: 'Video',
  imageModeLabel: 'Image',
  videoModeLabel: 'Video',
  analysisModeLabel: 'Analyze',
  typeLabel: 'Generation type',
} as CanvasLabels;

test('renders the selected generation type as a compact composer field', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerTypePicker
      activeDraftId="draft-1"
      isDraftBusy={false}
      isOpen={false}
      labels={labels}
      onDraftTaskTypeChange={() => {}}
      onOpenChange={() => {}}
      selectedType="image"
    />
  );

  assert.match(html, />Image</);
  assert.match(html, /rounded-full/);
  assert.match(html, /aria-label="Generation type"/);
  assert.doesNotMatch(html, />Video</);
});

test('open type picker keeps Canvas aligned with Studio image, video, and analysis modes', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerTypePicker
      activeDraftId="draft-1"
      isDraftBusy={false}
      isOpen
      labels={labels}
      onDraftTaskTypeChange={() => {}}
      onOpenChange={() => {}}
      selectedType="video"
    />
  );

  assert.match(html, />Image</);
  assert.match(html, />Video</);
  assert.match(html, />Analyze</);
  assert.match(html, /text-\[var\(--beat-accent\)\]/);
});
