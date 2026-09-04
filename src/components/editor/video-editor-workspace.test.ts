import assert from 'node:assert/strict';
import test from 'node:test';

import { createTimelineDocument } from '@/core/editor/timeline-document';
import { applyEditorOperations } from '@/core/commands/editor-commands';
import {
  findVisualClipAtTimelineTime,
  moveOverlayInPreview,
  PROJECT_TIMELINE_EXTERNAL_POLL_INTERVAL_MS,
  shouldPersistTimelineDocument,
  timelineDocumentsEqualForPersistence,
} from './video-editor-workspace';

test('overlay preview dragging maps pixels to normalized frame coordinates', () => {
  assert.deepEqual(
    moveOverlayInPreview({
      originX: 0.5,
      originY: 0.25,
      deltaX: 100,
      deltaY: 50,
      frameWidth: 500,
      frameHeight: 1000,
    }),
    { x: 0.7, y: 0.3 }
  );
  assert.deepEqual(
    moveOverlayInPreview({
      originX: 0.98,
      originY: 0.02,
      deltaX: 100,
      deltaY: -100,
      frameWidth: 500,
      frameHeight: 1000,
    }),
    { x: 1, y: 0 }
  );
});

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

test('preview follows the visual clip at the playhead even when another clip is selected', () => {
  const timeline = applyEditorOperations(
    createTimelineDocument({ projectId: 'project-1', name: 'Timeline' }),
    [
      {
        type: 'add_clip',
        assetId: 'visual-a',
        sourceUrl: '/visual-a.mp4',
        name: 'Visual A',
        sourceType: 'video',
        sourceDuration: 4,
      },
      {
        type: 'add_clip',
        assetId: 'visual-b',
        sourceUrl: '/visual-b.mp4',
        name: 'Visual B',
        sourceType: 'video',
        sourceDuration: 3,
      },
      {
        type: 'add_clip',
        assetId: 'music',
        sourceUrl: '/music.mp3',
        name: 'Music',
        sourceType: 'audio',
        sourceDuration: 7,
        startTime: 0,
      },
      {
        type: 'add_overlay',
        assetId: 'brand',
        sourceUrl: '/brand.png',
        name: 'Brand overlay',
        startTime: 1,
        duration: 2,
      },
    ]
  ).document;

  assert.equal(findVisualClipAtTimelineTime(timeline, 1)?.name, 'Visual A');
  assert.equal(findVisualClipAtTimelineTime(timeline, 2)?.name, 'Visual A');
  assert.equal(findVisualClipAtTimelineTime(timeline, 5)?.name, 'Visual B');
  assert.equal(findVisualClipAtTimelineTime(timeline, 7)?.name, 'Visual B');
});
