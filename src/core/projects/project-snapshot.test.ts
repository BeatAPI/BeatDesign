import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeProjectSnapshotDocument,
  isDestructiveEmptyProjectSnapshot,
  ProjectSnapshotValidationError,
} from './project-snapshot';

test('detects only non-empty to empty snapshot replacement as destructive', () => {
  const empty = normalizeProjectSnapshotDocument({ version: 3, cards: [], frames: {} });
  const populated = normalizeProjectSnapshotDocument({
    version: 3,
    cards: [
      {
        id: 'asset-1',
        assetId: 'asset-1',
        kind: 'asset',
        type: 'image',
        name: 'Reference',
        url: '/api/app/projects/project-1/assets/asset-1',
        prompt: '',
        referenceCardIds: [],
        workflowTemplateId: null,
        status: 'succeeded',
        error: null,
        modelId: '',
        aspectRatio: '1:1',
        outputQuality: '1k',
        duration: '5s',
        mode: 'quality',
        variant: 'standard',
        quality: 'standard',
        sourceGenerationId: null,
      },
    ],
    frames: {},
  });

  assert.equal(
    isDestructiveEmptyProjectSnapshot({ previous: populated, next: empty }),
    true
  );
  assert.equal(
    isDestructiveEmptyProjectSnapshot({ previous: populated, next: populated }),
    false
  );
  assert.equal(
    isDestructiveEmptyProjectSnapshot({ previous: empty, next: empty }),
    false
  );
});

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
