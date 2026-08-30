import assert from 'node:assert/strict';
import test from 'node:test';

import { createTimelineDocument } from '@/core/editor/timeline-document';
import {
  PROJECT_TIMELINE_EXTERNAL_POLL_INTERVAL_MS,
  shouldPersistTimelineDocument,
  timelineDocumentsEqualForPersistence,
} from './video-editor-workspace';

test('does not echo a remotely loaded timeline back through UI autosave', () => {
  const remote = createTimelineDocument({
    projectId: 'project-1',
    name: 'Remote timeline',
  });

  assert.equal(
    shouldPersistTimelineDocument({
      isHydrated: true,
      document: remote,
      lastSavedDocument: structuredClone(remote),
    }),
    false
  );
  assert.equal(
    shouldPersistTimelineDocument({
      isHydrated: true,
      document: { ...remote, name: 'Local edit' },
      lastSavedDocument: remote,
    }),
    true
  );
});

test('server-only timestamp normalization does not create an autosave echo', () => {
  const local = createTimelineDocument({
    projectId: 'project-1',
    name: 'Timeline',
  });
  const saved = {
    ...structuredClone(local),
    updatedAt: new Date(Date.now() + 1_000).toISOString(),
  };

  assert.equal(timelineDocumentsEqualForPersistence(local, saved), true);
  assert.equal(
    shouldPersistTimelineDocument({
      isHydrated: true,
      document: local,
      lastSavedDocument: saved,
    }),
    false
  );
});

test('editor checks for Agent changes within two seconds', () => {
  assert.equal(PROJECT_TIMELINE_EXTERNAL_POLL_INTERVAL_MS, 2_000);
});

test('does not persist the empty bootstrap document before hydration finishes', () => {
  const remote = createTimelineDocument({
    projectId: 'project-1',
    name: 'Remote timeline',
  });
  const bootstrap = createTimelineDocument({
    projectId: 'project-1',
    name: 'Bootstrap timeline',
  });

  assert.equal(
    shouldPersistTimelineDocument({
      isHydrated: false,
      document: bootstrap,
      lastSavedDocument: remote,
    }),
    false
  );
});
