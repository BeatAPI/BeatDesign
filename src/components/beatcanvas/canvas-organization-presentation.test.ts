import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import { captureCanonicalCanvasFrames } from './use-beatcanvas-react-flow-adapter';

test('snapshot capture preserves unmounted history frames while updating live card positions', () => {
  const cards = {
    draft: buildTextCard({ id: 'draft', name: 'Draft' }),
    old: buildTextCard({ id: 'old', name: 'Old take' }),
  };
  const previousFrames = {
    draft: { x: 0, y: 0, w: 320, h: 180 },
    old: { x: 400, y: 0, w: 320, h: 180 },
    deleted: { x: 900, y: 0, w: 320, h: 180 },
  };
  const before = structuredClone(previousFrames);
  const frames = captureCanonicalCanvasFrames({
    cards,
    previousFrames,
    readBounds: (id) =>
      id === 'draft' ? { x: 120, y: 50, w: 320, h: 180 } : null,
  });
  assert.deepEqual(frames.draft, { x: 120, y: 50, w: 320, h: 180 });
  assert.deepEqual(frames.old, previousFrames.old);
  assert.equal('deleted' in frames, false);
  assert.deepEqual(previousFrames, before);
  frames.old.x = -10;
  assert.equal(
    previousFrames.old.x,
    400,
    'caller frame snapshots cannot alias mutable runtime state'
  );
});
