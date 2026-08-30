import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveVideoFrameTimestamp } from './video-frame';

test('tail frame extraction seeks to the last decodable frame', () => {
  assert.equal(resolveVideoFrameTimestamp({ durationSeconds: 10, position: 'last' }), 10 - 1 / 30);
});
test('explicit frame extraction clamps to the source duration', () => {
  assert.equal(resolveVideoFrameTimestamp({ durationSeconds: 5, position: 9 }), 5 - 1 / 30);
  assert.equal(resolveVideoFrameTimestamp({ durationSeconds: 5, position: -1 }), 0);
});
