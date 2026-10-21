import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from '../beatcanvas/text-nodes';
import { normalizeProjectSnapshotDocument } from '../projects/project-snapshot';
import { applyCanvasOperations } from './canvas-commands';
import { beatDesignCommandSchema, uiCommandRequestSchema } from './schema';

const frame = { x: 0, y: 0, w: 200, h: 100 };
const group = (groupId: string, memberCardIds: string[]) => ({
  type: 'create_group' as const,
  groupId,
  name: groupId,
  role: 'shot' as const,
  memberCardIds,
  summaryFrame: frame,
  expandedFrame: frame,
});
const base = () =>
  normalizeProjectSnapshotDocument({
    cards: ['a', 'b'].map((id) =>
      buildTextCard({ id, name: id, textContent: '', textRole: 'note' })
    ),
    frames: { a: frame, b: { ...frame, x: 240 } },
  });

test('mixed command batches validate final membership and preserve operation ordering', () => {
  const first = applyCanvasOperations(base(), [
    group('g1', ['a', 'b']),
  ]).document;
  const result = applyCanvasOperations(first, [
    group('g2', ['a']),
    { type: 'move_group', groupId: 'g2', deltaX: 50, deltaY: 20 },
    { type: 'set_group_members', groupId: 'g1', memberCardIds: ['b'] },
    { type: 'move_card', cardId: 'a', frame: { ...frame, x: 90 } },
  ]).document;
  assert.deepEqual(result.organization?.groups.g2.memberCardIds, ['a']);
  assert.equal(result.frames.a.x, 90);
  assert.deepEqual(first.organization?.groups.g1.memberCardIds, ['a', 'b']);
  assert.throws(
    () => applyCanvasOperations(first, [group('bad', ['a'])]),
    /more than one group/
  );
});

test('semantic organization can reference a card created later in the same atomic batch', () => {
  const card = buildTextCard({
    id: 'later',
    name: 'Later',
    textContent: '',
    textRole: 'note',
  });
  const operations = [
    group('g', ['later']),
    { type: 'upsert_card' as const, card, frame },
  ];
  beatDesignCommandSchema.parse({ type: 'canvas.apply', operations });
  const result = applyCanvasOperations(base(), operations).document;
  assert.deepEqual(result.organization?.groups.g.memberCardIds, ['later']);
  const removed = applyCanvasOperations(result, [
    { type: 'update_group', groupId: 'g', resultCardId: 'later' },
    { type: 'remove_card', cardId: 'later' },
  ]).document;
  assert.deepEqual(removed.organization?.groups.g.memberCardIds, []);
  assert.equal(removed.organization?.groups.g.resultCardId, null);
  assert.equal(removed.cards.length, 2);
});

test('new commands require explicit stable envelope while legacy editing remains compatible', () => {
  const command = { type: 'canvas.apply', operations: [group('g', ['a'])] };
  assert.throws(
    () => uiCommandRequestSchema.parse({ command }),
    /commandId|revision|Revision|idempotency/
  );
  assert.doesNotThrow(() =>
    uiCommandRequestSchema.parse({
      commandId: 'cmd',
      idempotencyKey: 'cmd',
      expectedRevision: 0,
      command,
    })
  );
  assert.doesNotThrow(() =>
    uiCommandRequestSchema.parse({
      command: {
        type: 'canvas.apply',
        operations: [{ type: 'move_card', cardId: 'a', frame }],
      },
    })
  );
  assert.doesNotThrow(() =>
    beatDesignCommandSchema.parse({
      type: 'organization.apply',
      operations: [
        {
          type: 'create_folder',
          folderId: 'folder',
          name: 'Folder',
          parentId: null,
        },
      ],
    })
  );
  assert.throws(() =>
    beatDesignCommandSchema.parse({
      type: 'canvas.apply',
      operations: [{ ...group('g', ['a']), unknown: true }],
    })
  );
});
