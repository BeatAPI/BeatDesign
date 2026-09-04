import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addOverlayClip,
  addSourceClip,
  activateTimelineTake,
  addTimelineTake,
  calculateTimelineDuration,
  createTimelineDocument,
  findTimelineClip,
  getTimelineClipSource,
  normalizeTimelineDocument,
  overlayOpacityAt,
  moveTimelineClip,
  rippleDeleteTimelineClip,
  resizeTimelineClip,
  updateTimelineAudioClip,
  updateTimelineOverlay,
  splitTimelineClip,
  trimTimelineClip,
} from './timeline-document';

test('a ten-second source can be trimmed to a precise four-second clip', () => {
  const empty = createTimelineDocument({
    projectId: 'project-1',
    name: 'Demo',
  });
  const imported = addSourceClip(empty, {
    assetId: 'asset-1',
    sourceUrl: '/media/asset-1.mp4',
    name: 'ten-seconds.mp4',
    sourceType: 'video',
    sourceDuration: 10,
  });
  const clip = imported.tracks.flatMap((track) => track.clips)[0];
  assert.ok(clip);

  const trimmed = trimTimelineClip(imported, clip.id, 3, 7);
  const result = findTimelineClip(trimmed, clip.id);

  assert.equal(result?.inPoint, 3);
  assert.equal(result?.outPoint, 7);
  assert.equal(result?.duration, 4);
  assert.equal(calculateTimelineDuration(trimmed.tracks), 4);
});

test('version 1 timelines migrate with empty Take and render state', () => {
  const current = createTimelineDocument({ projectId: 'project-1', name: 'Demo' });
  const legacy = {
    ...current,
    schemaVersion: 1,
    tracks: current.tracks.map((track) => ({
      ...track,
      clips: track.clips.map(({ takes: _takes, activeTakeId: _active, ...clip }) => clip),
    })),
  };
  delete (legacy as Partial<typeof current>).lastRenderAssetId;
  delete (legacy as Partial<typeof current>).lastRenderUrl;
  delete (legacy as Partial<typeof current>).captionStyle;

  const migrated = normalizeTimelineDocument(legacy, 'project-1');
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.lastRenderAssetId, null);
  assert.equal(migrated.captionStyle, 'classic');
  assert.ok(migrated.tracks.some((track) => track.kind === 'overlay'));
});

test('version 2 timelines migrate the visual track without losing clips', () => {
  const withVideo = addSourceClip(
    createTimelineDocument({ projectId: 'project-1', name: 'Demo' }),
    {
      assetId: 'video-1',
      sourceUrl: '/video.mp4',
      name: 'video.mp4',
      sourceType: 'video',
      sourceDuration: 4,
    }
  );
  const legacy = {
    ...withVideo,
    schemaVersion: 2,
    tracks: withVideo.tracks.map((track) => ({
      ...track,
      name: track.kind === 'video' ? 'Video 1' : track.name,
    })),
  };
  const migrated = normalizeTimelineDocument(legacy, 'project-1');
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.tracks[0]?.name, 'Visual 1');
  assert.equal(migrated.tracks[0]?.clips.length, 1);
});

test('image overlays have independent timing, transform, and fades', () => {
  let document = createTimelineDocument({ projectId: 'project-1', name: 'Demo' });
  document = addSourceClip(document, {
    assetId: 'video-1',
    sourceUrl: '/video.mp4',
    name: 'video.mp4',
    sourceType: 'video',
    sourceDuration: 15,
  });
  document = addOverlayClip(document, {
    clipId: 'brand-overlay',
    assetId: 'brand-1',
    sourceUrl: '/brand.png',
    name: 'BeatDesign brand',
    startTime: 12.4,
    duration: 2.6,
    x: 0.52,
    y: 0.3,
    width: 0.64,
    fadeIn: 0.6,
  });
  const overlay = findTimelineClip(document, 'brand-overlay');
  assert.ok(overlay?.overlay);
  assert.equal(overlay.startTime, 12.4);
  assert.equal(overlayOpacityAt(overlay, 12.4), 0);
  assert.ok(overlayOpacityAt(overlay, 12.7) > 0.49);

  const updated = updateTimelineOverlay(document, overlay.id, {
    opacity: 0.8,
    rotation: 8,
  });
  assert.equal(findTimelineClip(updated, overlay.id)?.overlay?.opacity, 0.8);
  assert.equal(findTimelineClip(updated, overlay.id)?.overlay?.rotation, 8);
});

test('image clips share the visual track and can change still duration', () => {
  const imported = addSourceClip(
    createTimelineDocument({ projectId: 'project-1', name: 'Demo' }),
    {
      assetId: 'image-1',
      sourceUrl: '/still.png',
      name: 'still.png',
      sourceType: 'image',
      sourceDuration: 3,
    }
  );
  const clip = imported.tracks.find((track) => track.kind === 'video')?.clips[0];
  assert.ok(clip);
  assert.equal(clip.sourceType, 'image');
  const resized = resizeTimelineClip(imported, clip.id, 5.5);
  const result = findTimelineClip(resized, clip.id);
  assert.equal(result?.duration, 5.5);
  assert.equal(result?.sourceDuration, 5.5);
  assert.equal(calculateTimelineDuration(resized.tracks), 5.5);
});

test('a generated Take can replace a clip and roll back without changing the original', () => {
  const imported = addSourceClip(
    createTimelineDocument({ projectId: 'project-1', name: 'Demo' }),
    {
      assetId: 'asset-original',
      sourceUrl: '/original.mp4',
      name: 'original.mp4',
      sourceType: 'video',
      sourceDuration: 10,
    }
  );
  const original = imported.tracks.flatMap((track) => track.clips)[0];
  assert.ok(original);
  const trimmed = trimTimelineClip(imported, original.id, 3, 7);
  const withTake = addTimelineTake(trimmed, original.id, {
    id: 'take-1',
    assetId: 'asset-ai',
    sourceUrl: '/ai.mp4',
    name: 'AI Take',
    sourceDuration: 4.1,
    sourceGenerationId: 'generation-1',
    prompt: 'Make it cinematic',
  });
  const active = activateTimelineTake(withTake, original.id, 'take-1');
  const activeClip = findTimelineClip(active, original.id);
  assert.ok(activeClip);
  assert.equal(getTimelineClipSource(activeClip).sourceUrl, '/ai.mp4');
  assert.equal(activeClip.assetId, 'asset-original');
  assert.equal(activeClip.inPoint, 3);
  assert.equal(activeClip.outPoint, 7);

  const rolledBack = activateTimelineTake(active, original.id, null);
  const rolledBackClip = findTimelineClip(rolledBack, original.id);
  assert.ok(rolledBackClip);
  assert.equal(getTimelineClipSource(rolledBackClip).sourceUrl, '/original.mp4');
});

test('splitting is non-destructive and preserves the selected source range', () => {
  const empty = createTimelineDocument({ projectId: 'project-1', name: 'Demo' });
  const imported = addSourceClip(empty, {
    assetId: 'asset-1',
    sourceUrl: '/media/asset-1.mp4',
    name: 'ten-seconds.mp4',
    sourceType: 'video',
    sourceDuration: 10,
  });
  const original = imported.tracks.flatMap((track) => track.clips)[0];
  assert.ok(original);
  const trimmed = trimTimelineClip(imported, original.id, 3, 7);
  const split = splitTimelineClip(trimmed, original.id, 5);
  const clips = split.tracks.flatMap((track) => track.clips);

  assert.equal(clips.length, 2);
  assert.deepEqual(
    clips.map(({ inPoint, outPoint, duration, startTime }) => ({
      inPoint,
      outPoint,
      duration,
      startTime,
    })),
    [
      { inPoint: 3, outPoint: 5, duration: 2, startTime: 0 },
      { inPoint: 5, outPoint: 7, duration: 2, startTime: 2 },
    ]
  );
  assert.equal(calculateTimelineDuration(split.tracks), 4);
});

test('invalid trims and edge splits keep the original document unchanged', () => {
  const empty = createTimelineDocument({ projectId: 'project-1', name: 'Demo' });
  const imported = addSourceClip(empty, {
    assetId: 'asset-1',
    sourceUrl: '/media/asset-1.mp4',
    name: 'ten-seconds.mp4',
    sourceType: 'video',
    sourceDuration: 10,
  });
  const clip = imported.tracks.flatMap((track) => track.clips)[0];
  assert.ok(clip);

  assert.equal(trimTimelineClip(imported, clip.id, 4, 4), imported);
  assert.equal(splitTimelineClip(imported, clip.id, 0), imported);
  assert.equal(splitTimelineClip(imported, clip.id, 10), imported);
});

test('video clips append on the video track instead of after a longer audio bed', () => {
  const empty = createTimelineDocument({ projectId: 'project-1', name: 'Demo' });
  const withAudio = addSourceClip(empty, {
    assetId: 'audio-1',
    sourceUrl: '/music.mp3',
    name: 'music.mp3',
    sourceType: 'audio',
    sourceDuration: 30,
    startTime: 0,
  });
  const withVideo = addSourceClip(withAudio, {
    assetId: 'video-1',
    sourceUrl: '/shot.mp4',
    name: 'shot.mp4',
    sourceType: 'video',
    sourceDuration: 5,
  });
  const video = withVideo.tracks
    .find((track) => track.kind === 'video')
    ?.clips[0];
  assert.equal(video?.startTime, 0);
});

test('move rejects overlap and ripple delete closes the removed gap', () => {
  let timeline = createTimelineDocument({ projectId: 'project-1', name: 'Demo' });
  timeline = addSourceClip(timeline, {
    assetId: 'video-1', sourceUrl: '/1.mp4', name: '1', sourceType: 'video', sourceDuration: 3,
  });
  timeline = addSourceClip(timeline, {
    assetId: 'video-2', sourceUrl: '/2.mp4', name: '2', sourceType: 'video', sourceDuration: 3,
  });
  const [first, second] = timeline.tracks.find((track) => track.kind === 'video')!.clips;
  assert.ok(first && second);
  assert.equal(moveTimelineClip(timeline, second.id, 2), timeline);
  const moved = moveTimelineClip(timeline, second.id, 4);
  assert.equal(findTimelineClip(moved, second.id)?.startTime, 4);
  const deleted = rippleDeleteTimelineClip(moved, first.id);
  assert.equal(findTimelineClip(deleted, second.id)?.startTime, 1);
});

test('audio volume, mute, and fades are non-destructive clip settings', () => {
  const imported = addSourceClip(
    createTimelineDocument({ projectId: 'project-1', name: 'Demo' }),
    {
      assetId: 'audio-1', sourceUrl: '/music.mp3', name: 'music', sourceType: 'audio', sourceDuration: 5,
    }
  );
  const clip = imported.tracks.find((track) => track.kind === 'audio')!.clips[0]!;
  const updated = updateTimelineAudioClip(imported, clip.id, {
    volume: 0.5,
    muted: true,
    fadeIn: 1,
    fadeOut: 1.5,
  });
  const result = findTimelineClip(updated, clip.id);
  assert.equal(result?.volume, 0.5);
  assert.equal(result?.muted, true);
  assert.equal(result?.fadeIn, 1);
  assert.equal(result?.fadeOut, 1.5);
});
