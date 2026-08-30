import assert from 'node:assert/strict';
import test from 'node:test';

import { addSourceClip, createTimelineDocument } from './timeline-document';
import {
  buildTimelineDragPreview,
  timelineTimeFromClientX,
} from './timeline-interaction';

const makeTimeline = () => {
  let document = createTimelineDocument({ projectId: 'project-1', name: 'Edit' });
  document = addSourceClip(document, {
    assetId: 'image-1',
    sourceUrl: '/image-1.webp',
    name: 'Image',
    sourceType: 'image',
    sourceDuration: 4,
    startTime: 0,
  });
  document = addSourceClip(document, {
    assetId: 'video-1',
    sourceUrl: '/video-1.mp4',
    name: 'Video',
    sourceType: 'video',
    sourceDuration: 8,
    startTime: 4,
  });
  return document;
};

test('maps pointer coordinates to a clamped timeline time', () => {
  assert.equal(
    timelineTimeFromClientX({ clientX: 150, left: 100, width: 200, duration: 8 }),
    2
  );
  assert.equal(
    timelineTimeFromClientX({ clientX: 500, left: 100, width: 200, duration: 8 }),
    8
  );
});

test('resizes an image from either edge without crossing adjacent clips', () => {
  const document = makeTimeline();
  const image = document.tracks.flatMap((track) => track.clips)[0];

  const shorter = buildTimelineDragPreview({
    document,
    clip: image,
    mode: 'trim-end',
    deltaTime: -2,
  });
  assert.equal(shorter.duration, 2);
  assert.equal(shorter.outPoint, 2);

  const blockedByVideo = buildTimelineDragPreview({
    document,
    clip: image,
    mode: 'trim-end',
    deltaTime: 3,
  });
  assert.equal(blockedByVideo.duration, 4);
});

test('left video trim advances source in point and preserves the right edge', () => {
  const document = makeTimeline();
  const video = document.tracks.flatMap((track) => track.clips)[1];
  const preview = buildTimelineDragPreview({
    document,
    clip: video,
    mode: 'trim-start',
    deltaTime: 2,
  });

  assert.equal(preview.startTime, 6);
  assert.equal(preview.inPoint, 2);
  assert.equal(preview.duration, 6);
  assert.equal(preview.startTime + preview.duration, 12);
});
