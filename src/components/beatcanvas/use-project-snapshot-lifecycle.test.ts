import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROJECT_SNAPSHOT_AUTOSAVE_DELAY_MS,
  PROJECT_SNAPSHOT_CHECKPOINT_INTERVAL_MS,
  buildProjectPathWithoutEntryIntentSearch,
  buildProjectSnapshotRequestHeaders,
} from './use-project-snapshot-lifecycle';
import { readFileSync } from 'node:fs';

test('removes one-time prompt and template query params without dropping other params', () => {
  const path = buildProjectPathWithoutEntryIntentSearch({
    projectPath: '/canvas/project-1',
    search: '?target=image&template=ecommerce-collage&prompt=hero&foo=bar',
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

test('snapshot autosave preserves the local draft and stops after a version conflict', () => {
  const source = readFileSync(
    new URL('./use-project-snapshot-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /snapshotConflictRef\.current = true/);
  assert.match(source, /onProjectSnapshotConflict\?\.\(\)/);
  assert.equal(source.match(/await sendSaveRequest/g)?.length, 1);
  assert.doesNotMatch(source, /let response/);
});
