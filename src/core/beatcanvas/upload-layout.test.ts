import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNonOverlappingPlacement } from './upload-layout';

test('shifts a new card off an occupied canvas frame', () => {
  const next = resolveNonOverlappingPlacement({
    x: 0,
    y: 0,
    w: 200,
    h: 360,
    occupied: [{ x: 0, y: 0, w: 200, h: 360 }],
  });
  assert.equal(next.y, 0);
  assert.ok(next.x >= 200);
});

test('stacks later cards beside earlier occupied frames', () => {
  const first = { x: 80, y: 80, w: 360, h: 260 };
  const secondPoint = resolveNonOverlappingPlacement({
    ...first,
    occupied: [first],
  });
  const second = { ...first, ...secondPoint };
  const thirdPoint = resolveNonOverlappingPlacement({
    ...first,
    occupied: [first, second],
  });
  assert.notEqual(secondPoint.x, first.x);
  assert.notEqual(thirdPoint.x, first.x);
  assert.notEqual(thirdPoint.x, secondPoint.x);
});
