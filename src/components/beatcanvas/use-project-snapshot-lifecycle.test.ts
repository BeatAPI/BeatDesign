import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import {
  PROJECT_SNAPSHOT_AUTOSAVE_DELAY_MS,
  PROJECT_SNAPSHOT_CHECKPOINT_INTERVAL_MS,
  PROJECT_SNAPSHOT_EXTERNAL_POLL_INTERVAL_MS,
  buildProjectPathWithoutEntryIntentSearch,
  buildProjectSnapshotRequestHeaders,
  mergeProjectSnapshotsAfterConflict,
} from './use-project-snapshot-lifecycle';

test('removes one-time prompt and template query params without dropping other params', () => {
  const path = buildProjectPathWithoutEntryIntentSearch({
    projectPath: '/canvas/project-1',
    search: '?target=image&template=starter-collage&prompt=hero&foo=bar',
  });

  assert.equal(path, '/canvas/project-1?target=image&foo=bar');
});

test('snapshot autosave includes the trusted workspace mutation marker', () => {
  assert.deepEqual(buildProjectSnapshotRequestHeaders(), {
    'content-type': 'application/json',
    'x-beatapi-workspace-request': '1',
  });
});

test('snapshot persistence uses a fast debounce plus a five-second dirty checkpoint', () => {
  assert.equal(PROJECT_SNAPSHOT_AUTOSAVE_DELAY_MS, 350);
  assert.equal(PROJECT_SNAPSHOT_CHECKPOINT_INTERVAL_MS, 5_000);

  const source = readFileSync(
    new URL('./use-project-snapshot-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /window\.setInterval/);
  assert.match(source, /serializedSnapshot === lastSavedProjectSnapshotRef\.current/);
});

test('canvas checks for Agent changes within two seconds', () => {
  assert.equal(PROJECT_SNAPSHOT_EXTERNAL_POLL_INTERVAL_MS, 2_000);
});

test('canvas external polling rebases pending local edits instead of blocking Agent refreshes', () => {
  const source = readFileSync(
    new URL('./use-project-snapshot-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /if \(pendingProjectSnapshotRef\.current\) \{\s*return;\s*\}/
  );
  assert.match(source, /const pendingSnapshot = pendingProjectSnapshotRef\.current/);
  assert.match(source, /local: pendingSnapshot,/);
  assert.match(source, /remote: payload\.document,/);
  assert.match(source, /restoreProjectSnapshot\(snapshotToRestore\)/);
});

test('snapshot persistence flushes the complete current document when the page exits or becomes hidden', () => {
  const source = readFileSync(
    new URL('./use-project-snapshot-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /window\.addEventListener\('pagehide', flushPendingSnapshot\)/);
  assert.match(source, /window\.addEventListener\('beforeunload', flushPendingSnapshot\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(source, /keepalive: true/);
});

test('snapshot autosave sends explicit authorization before replacing a populated canvas with empty state', () => {
  const source = readFileSync(
    new URL('./use-project-snapshot-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /allowEmptyProjectSnapshot/);
  assert.match(source, /allowEmpty,/);
});

test('snapshot autosave retries a version conflict without permanently stopping sync', () => {
  const source = readFileSync(
    new URL('./use-project-snapshot-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /snapshotConflictRef/);
  assert.match(source, /mergeProjectSnapshotsAfterConflict/);
  assert.match(source, /response = await sendSaveRequest\(latest\.version\)/);
  assert.match(source, /onProjectSnapshotConflict\?\.\(\)/);
});

test('snapshot conflict recovery preserves independent local and Agent edits', () => {
  const base = normalizeProjectSnapshotDocument({
    version: 3,
    cards: [
      {
        id: 'draft-1',
        kind: 'generation',
        type: 'video',
        name: 'Draft',
        prompt: 'Base prompt',
        referenceCardIds: [],
      },
    ],
    frames: { 'draft-1': { x: 0, y: 0, w: 320, h: 180 } },
    camera: { x: 0, y: 0, z: 1 },
  });
  const local = normalizeProjectSnapshotDocument({
    ...base,
    cards: base.cards.map((card) => ({
      ...card,
      prompt: 'Locally edited prompt',
    })),
    frames: { 'draft-1': { x: 240, y: 120, w: 320, h: 180 } },
    camera: { x: 50, y: -20, z: 0.9 },
  });
  const remote = normalizeProjectSnapshotDocument({
    ...base,
    cards: [
      {
        ...base.cards[0],
        referenceCardIds: ['asset-agent'],
      },
      {
        id: 'asset-agent',
        assetId: 'asset-agent',
        kind: 'asset',
        type: 'video',
        name: 'Agent clip',
        url: '/api/app/projects/project-1/assets/asset-agent',
        referenceCardIds: [],
      },
    ],
    frames: {
      ...base.frames,
      'asset-agent': { x: 400, y: 0, w: 320, h: 180 },
    },
  });

  const merged = mergeProjectSnapshotsAfterConflict({ base, local, remote });
  const draft = merged.cards.find((card) => card.id === 'draft-1');

  assert.equal(draft?.prompt, 'Locally edited prompt');
  assert.deepEqual(draft?.referenceCardIds, ['asset-agent']);
  assert.ok(merged.cards.some((card) => card.id === 'asset-agent'));
  assert.equal(merged.frames['draft-1']?.x, 240);
  assert.equal(merged.frames['asset-agent']?.x, 400);
  assert.deepEqual(merged.camera, { x: 50, y: -20, z: 0.9 });
});
