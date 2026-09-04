import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCanvasPlacement } from './upload-layout';

test('centers a new target to the right of its reference column', () => {
  const sources = [
    { x: 20, y: 40, w: 200, h: 100 },
    { x: 20, y: 220, w: 200, h: 100 },
  ];

  assert.deepEqual(
    resolveCanvasPlacement({
      sourceFrames: sources,
      occupied: sources,
      size: { w: 300, h: 200 },
    }),
    { x: 316, y: 80 }
  );
});

test('supports deliberate left-side placement without changing the default', () => {
  const source = { x: 500, y: 100, w: 200, h: 200 };

  assert.deepEqual(
    resolveCanvasPlacement({
      sourceFrames: [source],
      occupied: [source],
      size: { w: 160, h: 120 },
      side: 'left',
    }),
    { x: 244, y: 140 }
  );
});
