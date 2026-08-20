import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAnchoredComposerPosition,
  resolveComposerFocusLayout,
} from './beatcanvas-composer-utils';

test('anchors the composer directly below the active frame', () => {
  assert.deepEqual(
    resolveAnchoredComposerPosition({
      frame: { left: 300, top: 80, width: 240, height: 420 },
      viewportWidth: 1200,
    }),
    { left: 140, top: 514 }
  );
});

test('keeps the anchored composer inside the canvas horizontally', () => {
  assert.deepEqual(
    resolveAnchoredComposerPosition({
      frame: { left: 2, top: 40, width: 236, height: 420 },
      viewportWidth: 900,
    }),
    { left: 16, top: 474 }
  );
});

test('reduces zoom only when the frame and composer do not fit vertically', () => {
  assert.deepEqual(
    resolveComposerFocusLayout({
      frameHeight: 420,
      viewportHeight: 576,
      composerHeight: 168,
      currentZoom: 1,
      zoomSteps: [0.2, 0.4, 0.6, 0.8, 1],
    }),
    { zoom: 0.8, verticalPageOffset: 96.25 }
  );

  assert.deepEqual(
    resolveComposerFocusLayout({
      frameHeight: 420,
      viewportHeight: 843,
      composerHeight: 168,
      currentZoom: 1,
      zoomSteps: [0.2, 0.4, 0.6, 0.8, 1],
    }),
    { zoom: 1, verticalPageOffset: 77 }
  );
});
