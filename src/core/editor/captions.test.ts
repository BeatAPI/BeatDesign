import assert from 'node:assert/strict';
import test from 'node:test';

import { applyEditorOperations } from '@/core/commands/editor-commands';

import {
  applySrtToTimeline,
  findCaptionAtTime,
  formatSrtTimestamp,
  parseSrt,
  parseSrtTimestamp,
} from './captions';
import {
  createTimelineDocument,
  normalizeTimelineDocument,
} from './timeline-document';
import { diagnoseTimeline } from './timeline-diagnostics';
import { wrapCaptionText } from './media-export';

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:01,500
Hello there

2
00:00:01,500 --> 00:00:03,000
Next line`;

test('parses SRT cues with comma timestamps', () => {
  assert.equal(parseSrtTimestamp('00:00:01,500'), 1.5);
  assert.equal(formatSrtTimestamp(1.5), '00:00:01,500');
  const cues = parseSrt(SAMPLE_SRT);
  assert.equal(cues.length, 2);
  assert.equal(cues[0]?.text, 'Hello there');
  assert.equal(cues[1]?.endTime, 3);
  assert.equal(formatSrtTimestamp(59.9996), '00:01:00,000');
  assert.throws(() => parseSrtTimestamp('00:60:00,000'), /invalid/);
});

test('import_srt places captions on a caption track', () => {
  const timeline = createTimelineDocument({ projectId: 'p1', name: 'Demo' });
  const next = applySrtToTimeline(timeline, SAMPLE_SRT);
  const captions = next.tracks.find((track) => track.kind === 'caption')?.clips ?? [];
  assert.equal(captions.length, 2);
  assert.equal(captions[0]?.sourceType, 'caption');
  assert.equal(captions[0]?.text, 'Hello there');
  assert.equal(captions[0]?.duration, 1.5);
  assert.doesNotThrow(() => normalizeTimelineDocument(next, 'p1'));
});

test('invalid SRT never replaces existing captions', () => {
  const timeline = applySrtToTimeline(
    createTimelineDocument({ projectId: 'p1', name: 'Demo' }),
    SAMPLE_SRT
  );
  assert.throws(() => applySrtToTimeline(timeline, 'not an SRT file', true));
  assert.equal(
    timeline.tracks.find((track) => track.kind === 'caption')?.clips.length,
    2
  );
});

test('muted caption tracks do not render and long lines wrap for export', () => {
  const timeline = applySrtToTimeline(
    createTimelineDocument({ projectId: 'p1', name: 'Demo' }),
    SAMPLE_SRT
  );
  const muted = {
    ...timeline,
    tracks: timeline.tracks.map((track) =>
      track.kind === 'caption' ? { ...track, muted: true } : track
    ),
  };
  assert.equal(findCaptionAtTime(muted, 0.5), null);
  assert.deepEqual(
    wrapCaptionText('hello world', 6, (value) => value.length),
    ['hello', 'world']
  );
});

test('editor import_srt operation is applied through the command kernel', () => {
  const timeline = createTimelineDocument({ projectId: 'p1', name: 'Demo' });
  const result = applyEditorOperations(timeline, [
    { type: 'import_srt', srt: SAMPLE_SRT, replace: true },
  ]);
  const captions =
    result.document.tracks.find((track) => track.kind === 'caption')?.clips ?? [];
  assert.equal(captions.length, 2);
  assert.equal(result.changedIds.includes(result.document.id), true);
});

test('caption overlap is diagnosed separately from video overlap', () => {
  const timeline = applyEditorOperations(
    createTimelineDocument({ projectId: 'p1', name: 'Demo' }),
    [
      {
        type: 'upsert_caption',
        clipId: 'cap-1',
        text: 'One',
        startTime: 0,
        duration: 2,
      },
      {
        type: 'upsert_caption',
        clipId: 'cap-2',
        text: 'Two',
        startTime: 1,
        duration: 2,
      },
    ]
  ).document;
  const diagnostics = diagnoseTimeline(timeline);
  assert.ok(diagnostics.some((item) => item.code === 'caption_overlap'));
});
