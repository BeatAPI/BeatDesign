import assert from 'node:assert/strict';
import test from 'node:test';

import { addSourceClip, createTimelineDocument, trimTimelineClip } from './timeline-document';
import { mergeTimelineDocuments } from './timeline-merge';

test('timeline merge preserves disjoint local and remote clip additions', () => {
  const base = createTimelineDocument({ projectId: 'project-1', name: 'Edit' });
  const local = addSourceClip(base, {
    clipId: 'local-clip',
    assetId: 'local-asset',
    sourceUrl: '/local.mp4',
    name: 'Local',
    sourceType: 'video',
    sourceDuration: 2,
  });
  const remote = addSourceClip(base, {
    clipId: 'remote-clip',
    assetId: 'remote-asset',
    sourceUrl: '/remote.mp3',
    name: 'Remote',
    sourceType: 'audio',
    sourceDuration: 4,
  });

  const result = mergeTimelineDocuments({ base, local, remote });
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(
    result.document.tracks.flatMap((track) => track.clips.map((clip) => clip.id)),
    ['local-clip', 'remote-clip']
  );
});

test('timeline merge reports two edits to the same clip field', () => {
  const empty = createTimelineDocument({ projectId: 'project-1', name: 'Edit' });
  const base = addSourceClip(empty, {
    clipId: 'clip-1',
    assetId: 'asset-1',
    sourceUrl: '/video.mp4',
    name: 'Video',
    sourceType: 'video',
    sourceDuration: 5,
  });
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.tracks[0].clips[0].name = 'Local name';
  remote.tracks[0].clips[0].name = 'Remote name';

  const result = mergeTimelineDocuments({ base, local, remote });
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0].path, /name$/);
  assert.equal(result.document.tracks[0].clips[0].name, 'Local name');
});

test('timeline merge keeps remote trimming when the local edit only renames the clip', () => {
  const base = addSourceClip(createTimelineDocument({ projectId: 'project-1', name: 'Edit' }), {
    clipId: 'clip-1', assetId: 'asset-1', sourceUrl: '/video.mp4', name: 'Video', sourceType: 'video', sourceDuration: 5,
  });
  const local = structuredClone(base);
  local.tracks[0].clips[0].name = 'Local name';
  const remote = trimTimelineClip(base, 'clip-1', 1, 4);
  const result = mergeTimelineDocuments({ base, local, remote });
  assert.equal(result.conflicts.length, 0);
  const clip = result.document.tracks[0].clips[0];
  assert.equal(clip.name, 'Local name');
  assert.equal(clip.inPoint, 1);
  assert.equal(clip.outPoint, 4);
  assert.equal(clip.duration, 3);
  assert.equal(result.document.duration, 3);
});

test('timeline merge reports conflicting clip durations instead of silently preferring local', () => {
  const base = addSourceClip(createTimelineDocument({ projectId: 'project-1', name: 'Edit' }), {
    clipId: 'clip-1', assetId: 'asset-1', sourceUrl: '/video.mp4', name: 'Video', sourceType: 'video', sourceDuration: 5,
  });
  const local = trimTimelineClip(base, 'clip-1', 0, 3);
  const remote = trimTimelineClip(base, 'clip-1', 0, 4);
  const result = mergeTimelineDocuments({ base, local, remote });
  assert.ok(result.conflicts.some(({ path }) => path.endsWith('.duration')));
  assert.equal(result.document.tracks[0].clips[0].duration, 3);
});
