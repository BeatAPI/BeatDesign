import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateTimelineTake,
  addTimelineTake,
  addSourceClip,
  createTimelineDocument,
  type TimelineDocument,
} from './timeline-document';
import { diagnoseTimeline } from './timeline-diagnostics';

test('a normal video-only timeline does not warn about its structural audio track', () => {
  let document = createTimelineDocument({ projectId: 'p1', name: 'Timeline' });
  document = addSourceClip(document, {
    assetId: 'v1',
    sourceUrl: '/v1.mp4',
    name: 'One',
    sourceType: 'video',
    sourceDuration: 2,
  });

  assert.deepEqual(diagnoseTimeline(document), []);
});

test('timeline diagnostics report an unexplained video gap and a missing source', () => {
    let document = createTimelineDocument({ projectId: 'p1', name: 'Timeline' });
    document = addSourceClip(document, {
      assetId: 'v1',
      sourceUrl: '/v1.mp4',
      name: 'One',
      sourceType: 'video',
      sourceDuration: 2,
    });
    document = addSourceClip(document, {
      assetId: 'v2',
      sourceUrl: '',
      name: 'Two',
      sourceType: 'video',
      sourceDuration: 1,
      startTime: 4,
    });

    const diagnostics = diagnoseTimeline(document);
    assert.ok(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'timeline_gap' &&
          diagnostic.severity === 'error' &&
          diagnostic.startTime === 2 &&
          diagnostic.endTime === 4
      )
    );
    assert.ok(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'media_missing' && diagnostic.severity === 'error'
      )
    );
});

test('timeline diagnostics report overlap in a malformed persisted document', () => {
    let document = createTimelineDocument({ projectId: 'p1', name: 'Timeline' });
    document = addSourceClip(document, {
      assetId: 'v1',
      sourceUrl: '/v1.mp4',
      name: 'One',
      sourceType: 'video',
      sourceDuration: 2,
    });
    document = addSourceClip(document, {
      assetId: 'v2',
      sourceUrl: '/v2.mp4',
      name: 'Two',
      sourceType: 'video',
      sourceDuration: 2,
    });
    const [first, second] = document.tracks[0].clips;
    const malformed: TimelineDocument = {
      ...document,
      tracks: document.tracks.map((track) =>
        track.kind === 'video'
          ? {
              ...track,
              clips: [first, { ...second, startTime: 1 }],
            }
          : track
      ),
    };

    assert.ok(
      diagnoseTimeline(malformed).some(
        (diagnostic) =>
          diagnostic.code === 'clip_overlap' && diagnostic.severity === 'error'
      )
    );
});

test('a take shorter than its clip cannot be activated', () => {
  const document = createTimelineDocument({
    projectId: 'project-1',
    name: 'Timeline 1',
  });
  const withClip = addSourceClip(document, {
    clipId: 'clip-1',
    assetId: 'asset-1',
    sourceUrl: '/video.mp4',
    name: 'Video',
    sourceType: 'video',
    sourceDuration: 4,
  });
  const withShortTake = addTimelineTake(withClip, 'clip-1', {
    id: 'take-1',
    assetId: 'take-asset',
    sourceUrl: '/take.mp4',
    name: 'Short Take',
    sourceDuration: 3,
    sourceGenerationId: 'generation-1',
    prompt: 'Redo',
  });
  assert.equal(withShortTake, withClip);
  assert.equal(activateTimelineTake(withShortTake, 'clip-1', 'take-1'), withShortTake);
});
