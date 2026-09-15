import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import { buildCanvasOperations } from './canvas-diff';
import { applyCanvasOperations } from './canvas-commands';
import { beatDesignCommandSchema } from './schema';
import { mergeProjectSnapshotsAfterConflict } from '@/components/beatcanvas/use-project-snapshot-lifecycle';

const base = normalizeProjectSnapshotDocument({
  cards: [{ id: 'draft', kind: 'generation', type: 'image', name: 'Draft', prompt: 'Original', referenceCardIds: [] }],
  frames: { draft: { x: 0, y: 0, w: 320, h: 180 } },
});

test('drag commands preserve a concurrent Agent prompt edit', () => {
  const local = { ...base, frames: { draft: { ...base.frames.draft, x: 200 } } };
  const operations = buildCanvasOperations(base, local);
  assert.deepEqual(operations.map((op) => op.type), ['move_card']);
  const remote = { ...base, cards: base.cards.map((card) => ({ ...card, prompt: 'Agent prompt' })) };
  const merged = mergeProjectSnapshotsAfterConflict({ base, local, remote });
  const command = beatDesignCommandSchema.parse({ type: 'canvas.apply', operations: buildCanvasOperations(remote, merged) });
  assert.equal(command.type, 'canvas.apply');
  const result = applyCanvasOperations(remote, operations).document;
  assert.equal(result.cards[0].prompt, 'Agent prompt');
  assert.equal(result.frames.draft.x, 200);
});

test('conflicting prompt edits and deletion versus edit are surfaced', () => {
  const local = { ...base, cards: base.cards.map((card) => ({ ...card, prompt: 'Local' })) };
  const remote = { ...base, cards: base.cards.map((card) => ({ ...card, prompt: 'Agent' })) };
  assert.throws(() => mergeProjectSnapshotsAfterConflict({ base, local, remote }), /Canvas edit conflict/);
  assert.throws(() => mergeProjectSnapshotsAfterConflict({ base, local, remote: { ...base, cards: [] } }), /deletion conflicts/);
});

test('incremental create, reference, camera, and confirmed delete round trip', () => {
  const next = normalizeProjectSnapshotDocument({
    ...base,
    cards: [...base.cards, { ...base.cards[0], id: 'next', referenceCardIds: ['draft'] }],
    frames: { ...base.frames, next: { x: 500, y: 0, w: 320, h: 180 } },
    camera: { x: 20, y: 10, z: 0.8 },
  });
  const operations = buildCanvasOperations(base, next);
  beatDesignCommandSchema.parse({ type: 'canvas.apply', operations });
  assert.deepEqual(applyCanvasOperations(base, operations).document, next);
  const empty = normalizeProjectSnapshotDocument({ cards: [], frames: {} });
  assert.throws(() => buildCanvasOperations(next, empty), /Unconfirmed/);
  assert.equal(applyCanvasOperations(next, buildCanvasOperations(next, empty, true)).document.cards.length, 0);
});
