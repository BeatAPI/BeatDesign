import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeRgbaPng } from './png-encode';
import { resolveVideoFrameTimestamp } from './video-frame';

test('encodes a tiny RGBA PNG with a valid signature', () => {
  const png = encodeRgbaPng({
    width: 1,
    height: 1,
    rgba: Uint8Array.from([255, 0, 0, 255]),
  });
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.byteLength > 40);
});

test('tail frame timestamp stays on the last displayable frame', () => {
  assert.equal(
    resolveVideoFrameTimestamp({ durationSeconds: 8, position: 'last' }),
    8 - 1 / 30
  );
});
