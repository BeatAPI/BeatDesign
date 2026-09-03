import {
  calculateTimelineDuration,
  type TimelineClip,
  type TimelineDocument,
  type TimelineTrack,
} from './timeline-document';

export const MAX_CAPTION_TEXT = 4_000;
export const MAX_SRT_CHARS = 200_000;
export const MAX_SRT_FILE_BYTES = MAX_SRT_CHARS * 4;

export type ParsedCaptionCue = {
  startTime: number;
  endTime: number;
  text: string;
};

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const roundTime = (value: number) => Math.round(value * 1000) / 1000;

const pad = (value: number, size: number) => String(value).padStart(size, '0');

export function parseSrtTimestamp(value: string) {
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) throw new Error('SRT timestamp is invalid.');
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = Number(match[4].padEnd(3, '0'));
  if (minutes > 59 || seconds > 59) {
    throw new Error('SRT timestamp is invalid.');
  }
  return roundTime(hours * 3600 + minutes * 60 + seconds + fraction / 1000);
}

export function formatSrtTimestamp(value: number) {
  const totalMillis = Math.round(Math.max(0, value) * 1000);
  const totalSeconds = Math.floor(totalMillis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = totalMillis % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

export function parseSrt(source: string): ParsedCaptionCue[] {
  const trimmed = source.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];
  if (trimmed.length > MAX_SRT_CHARS) {
    throw new Error('SRT file is too large.');
  }

  const blocks = trimmed.split(/\r?\n\r?\n/);
  const cues: ParsedCaptionCue[] = [];
  for (const [blockIndex, block] of blocks.entries()) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const timingIndex = lines[0]?.includes('-->') ? 0 : 1;
    const timing = lines[timingIndex];
    if (!timing?.includes('-->')) {
      throw new Error(`SRT cue ${blockIndex + 1} has no valid timing line.`);
    }
    const [startRaw, endRaw] = timing.split('-->').map((part) => part.trim());
    if (!startRaw || !endRaw) {
      throw new Error(`SRT cue ${blockIndex + 1} has invalid timing.`);
    }
    const startTime = parseSrtTimestamp(startRaw);
    const endTime = parseSrtTimestamp(endRaw);
    if (!(endTime > startTime)) {
      throw new Error(`SRT cue ${blockIndex + 1} must end after it starts.`);
    }
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .slice(0, MAX_CAPTION_TEXT)
      .trim();
    if (!text) {
      throw new Error(`SRT cue ${blockIndex + 1} has no caption text.`);
    }
    cues.push({ startTime: roundTime(startTime), endTime: roundTime(endTime), text });
  }
  if (cues.length === 0) throw new Error('SRT contains no valid caption cues.');
  return cues;
}

export function serializeSrt(cues: readonly ParsedCaptionCue[]) {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTimestamp(cue.startTime)} --> ${formatSrtTimestamp(cue.endTime)}\n${cue.text}`
    )
    .join('\n\n');
}

export function createCaptionTrack(): TimelineTrack {
  return {
    id: createId('caption-track'),
    kind: 'caption',
    name: 'Captions',
    locked: false,
    hidden: false,
    muted: false,
    clips: [],
  };
}

export function ensureCaptionTrack(document: TimelineDocument): TimelineDocument {
  if (document.tracks.some((track) => track.kind === 'caption')) return document;
  const tracks = [...document.tracks, createCaptionTrack()];
  return {
    ...document,
    tracks,
    duration: calculateTimelineDuration(tracks),
    updatedAt: new Date().toISOString(),
  };
}

const captionClip = ({
  trackId,
  cue,
  clipId,
}: {
  trackId: string;
  cue: ParsedCaptionCue;
  clipId?: string;
}): TimelineClip => {
  const duration = roundTime(cue.endTime - cue.startTime);
  const id = clipId?.trim() || createId('caption');
  return {
    id,
    assetId: id,
    sourceUrl: '',
    trackId,
    name: cue.text.split('\n')[0]?.slice(0, 80) || 'Caption',
    sourceType: 'caption',
    startTime: roundTime(cue.startTime),
    duration,
    inPoint: 0,
    outPoint: duration,
    sourceDuration: duration,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    text: cue.text,
    takes: [],
    activeTakeId: null,
  };
};

export function upsertCaptionCue(
  document: TimelineDocument,
  cue: ParsedCaptionCue & { clipId: string }
) {
  const next = ensureCaptionTrack(document);
  const track = next.tracks.find((item) => item.kind === 'caption');
  if (!track) return document;
  const clip = captionClip({ trackId: track.id, cue, clipId: cue.clipId });
  const tracks = next.tracks.map((item) =>
    item.id !== track.id
      ? item
      : {
          ...item,
          clips: [...item.clips.filter((existing) => existing.id !== clip.id), clip].sort(
            (left, right) => left.startTime - right.startTime
          ),
        }
  );
  return {
    ...next,
    tracks,
    duration: calculateTimelineDuration(tracks),
    updatedAt: new Date().toISOString(),
  };
}

export function applySrtToTimeline(
  document: TimelineDocument,
  srt: string,
  replace = true
) {
  const cues = parseSrt(srt);
  const next = ensureCaptionTrack(document);
  const track = next.tracks.find((item) => item.kind === 'caption');
  if (!track) return next;
  const existing = replace ? [] : track.clips;
  const clips = [
    ...existing,
    ...cues.map((cue) => captionClip({ trackId: track.id, cue })),
  ].sort((left, right) => left.startTime - right.startTime);
  const tracks = next.tracks.map((item) =>
    item.id === track.id ? { ...item, clips } : item
  );
  return {
    ...next,
    tracks,
    duration: calculateTimelineDuration(tracks),
    updatedAt: new Date().toISOString(),
  };
}

export function findCaptionAtTime(document: TimelineDocument, time: number) {
  const track = document.tracks.find(
    (item) => item.kind === 'caption' && !item.hidden && !item.muted
  );
  if (!track) return null;
  return (
    track.clips.find(
      (clip) => time >= clip.startTime && time < clip.startTime + clip.duration
    ) ?? null
  );
}
