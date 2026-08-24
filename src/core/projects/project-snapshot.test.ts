import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeProjectSnapshotDocument,
  hasProjectSnapshotVersionConflict,
  isDestructiveEmptyProjectSnapshot,
  ProjectSnapshotValidationError,
} from './project-snapshot';

test('requires the current base version before changing a saved snapshot', () => {
  assert.equal(
    hasProjectSnapshotVersionConflict({
      currentVersion: 4,
      baseVersion: 4,
      documentChanged: true,
    }),
    false
  );
  assert.equal(
    hasProjectSnapshotVersionConflict({
      currentVersion: 4,
      baseVersion: 3,
      documentChanged: true,
    }),
    true
  );
  assert.equal(
    hasProjectSnapshotVersionConflict({
      currentVersion: 4,
      baseVersion: undefined,
      documentChanged: true,
    }),
    true
  );
  assert.equal(
    hasProjectSnapshotVersionConflict({
      currentVersion: 4,
      baseVersion: 3,
      documentChanged: false,
    }),
    false
  );
});

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

test('persists Canvas video analysis mode, depth, and text output', () => {
  const normalized = normalizeProjectSnapshotDocument({
    version: 3,
    cards: [
      {
        id: 'analysis-1',
        kind: 'generation',
        type: 'video',
        generationMode: 'analysis',
        analysisDepth: 'deep',
        name: 'Analyze',
        url: null,
        resultText: '00:00 The subject enters frame.',
        prompt: 'Return timestamps.',
        referenceCardIds: ['video-1'],
        workflowTemplateId: null,
        status: 'idle',
        error: null,
        modelId: 'video-analysis',
        aspectRatio: '16:9',
        outputQuality: '720p',
        duration: '5s',
        mode: 'quality',
        variant: 'standard',
        quality: 'standard',
        sourceGenerationId: null,
      },
    ],
    frames: {},
  });

  assert.equal(normalized.cards[0]?.generationMode, 'analysis');
  assert.equal(normalized.cards[0]?.analysisDepth, 'deep');
  assert.equal(
    normalized.cards[0]?.resultText,
    '00:00 The subject enters frame.'
  );
});
