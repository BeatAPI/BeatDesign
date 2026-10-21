import assert from 'node:assert/strict';
import test from 'node:test';
import { addSourceClip, createTimelineDocument } from './timeline-document';
import { getTimelineUsage } from './timeline-usage';

test('usage resolves actual active take ranges and preserves original trims without changing editing state', () => {
  const timeline = addSourceClip(
    createTimelineDocument({ projectId: 'fixture', name: 'Usage' }),
    {
      assetId: 'original',
      sourceUrl: '/original.mp4',
      name: 'Original',
      sourceType: 'video',
      sourceDuration: 20,
    }
  );
  const track = timeline.tracks.find((track) => track.kind === 'video')!;
  const clip = track.clips[0];
  Object.assign(clip, { startTime: 10, duration: 5, inPoint: 3, outPoint: 8 });
  clip.takes = [
    {
      id: 'adopted-take',
      assetId: 'adopted',
      sourceUrl: '/adopted.mp4',
      name: 'Adopted',
      sourceDuration: 3,
      sourceGenerationId: 'old-generation',
      prompt: '',
      createdAt: '2026-10-19',
    },
  ];
  const original = getTimelineUsage(timeline, 7).clips[0];
  assert.equal(original.assetId, 'original');
  assert.equal(original.sourceIn, 3);
  assert.equal(original.sourceOut, 8);
  clip.activeTakeId = 'adopted-take';
  track.hidden = true;
  clip.muted = true;
  const before = structuredClone(timeline);
  const usage = getTimelineUsage(timeline, 8);
  assert.equal(usage.timelineRevision, 8);
  assert.deepEqual(usage.clips[0], {
    trackId: track.id,
    clipId: clip.id,
    sourceType: 'video',
    sourceUrl: '/adopted.mp4',
    assetId: 'adopted',
    takeId: 'adopted-take',
    name: 'Original',
    timelineStart: 10,
    duration: 5,
    sourceIn: 0,
    sourceOut: 3,
    hidden: true,
    muted: true,
  });
  assert.deepEqual(timeline, before);
});

test('usage separates captions and does not create a Timeline for an empty project', () => {
  assert.deepEqual(getTimelineUsage(null, null), {
    timelineRevision: null,
    clips: [],
  });
  const timeline = addSourceClip(
    createTimelineDocument({ projectId: 'fixture', name: 'Caption' }),
    {
      assetId: 'image',
      sourceUrl: '/image.png',
      name: 'Image',
      sourceType: 'image',
      sourceDuration: 2,
    }
  );
  const clip = timeline.tracks.flatMap((track) => track.clips)[0];
  timeline.tracks.push({
    id: 'captions',
    kind: 'caption',
    name: 'Captions',
    hidden: false,
    muted: false,
    locked: false,
    clips: [
      {
        ...clip,
        id: 'caption',
        trackId: 'captions',
        sourceType: 'caption',
        text: 'A caption',
        assetId: 'caption-internal',
      },
    ],
  });
  const caption = getTimelineUsage(timeline, 1).clips.find(
    (clip) => clip.clipId === 'caption'
  );
  assert.equal(caption?.assetId, null);
  assert.equal(caption?.sourceType, 'caption');
});
