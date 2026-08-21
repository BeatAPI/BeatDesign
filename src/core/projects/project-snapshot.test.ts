import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeProjectSnapshotDocument,
  ProjectSnapshotValidationError,
} from './project-snapshot';

test('rejects snapshots with an excessive number of cards', () => {
  assert.throws(
    () =>
      normalizeProjectSnapshotDocument({
        cards: Array.from({ length: 201 }, (_, index) => ({
          id: `card-${index}`,
          kind: 'asset',
          type: 'image',
          name: `Card ${index}`,
        })),
        frames: {},
      }),
    ProjectSnapshotValidationError
  );
});

test('drops invalid card kinds and orphan frames', () => {
  assert.deepEqual(
    normalizeProjectSnapshotDocument({
      cards: [
        { id: 'bad', kind: 'script', type: 'image', name: 'Bad' },
        { id: 'good', kind: 'asset', type: 'image', name: 'Good' },
      ],
      frames: {
        good: { x: 0, y: 0, w: 100, h: 100 },
        orphan: { x: 0, y: 0, w: 100, h: 100 },
      },
    }).frames,
    { good: { x: 0, y: 0, w: 100, h: 100 } }
  );
});

test('keeps a valid canvas camera and drops an invalid one', () => {
  assert.deepEqual(
    normalizeProjectSnapshotDocument({
      cards: [],
      frames: {},
      camera: { x: 320, y: -180, z: 0.75 },
    }).camera,
    { x: 320, y: -180, z: 0.75 }
  );

  assert.equal(
    normalizeProjectSnapshotDocument({
      cards: [],
      frames: {},
      camera: { x: 0, y: 0, z: 0 },
    }).camera,
    undefined
  );
});
