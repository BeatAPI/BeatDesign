import type { TimelineClip, TimelineDocument } from './timeline-document';

export type TimelineDragMode = 'move' | 'trim-start' | 'trim-end';

export type TimelineClipInteractionPreview = Pick<
  TimelineClip,
  'id' | 'startTime' | 'duration' | 'inPoint' | 'outPoint' | 'sourceDuration'
>;

const MIN_DURATION = 0.04;

const roundTime = (value: number) => Math.round(value * 100) / 100;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function timelineTimeFromClientX({
  clientX,
  left,
  width,
  duration,
}: {
  clientX: number;
  left: number;
  width: number;
  duration: number;
}) {
  if (!Number.isFinite(width) || width <= 0 || duration <= 0) return 0;
  return roundTime(clamp((clientX - left) / width, 0, 1) * duration);
}

export function buildTimelineDragPreview({
  document,
  clip,
  mode,
  deltaTime,
}: {
  document: TimelineDocument;
  clip: TimelineClip;
  mode: TimelineDragMode;
  deltaTime: number;
}): TimelineClipInteractionPreview {
  const track = document.tracks.find((candidate) => candidate.id === clip.trackId);
  const otherClips = (track?.clips ?? [])
    .filter((candidate) => candidate.id !== clip.id)
    .sort((a, b) => a.startTime - b.startTime);
  const previousEnd = otherClips
    .filter((candidate) => candidate.startTime < clip.startTime)
    .reduce(
      (latest, candidate) =>
        Math.max(latest, candidate.startTime + candidate.duration),
      0
    );
  const nextStart =
    otherClips.find((candidate) => candidate.startTime > clip.startTime)
      ?.startTime ?? Number.POSITIVE_INFINITY;
  const originalEnd = clip.startTime + clip.duration;

  if (mode === 'move') {
    const maximumStart = Number.isFinite(nextStart)
      ? nextStart - clip.duration
      : Number.POSITIVE_INFINITY;
    const startTime = roundTime(
      clamp(clip.startTime + deltaTime, previousEnd, maximumStart)
    );
    return {
      id: clip.id,
      startTime,
      duration: clip.duration,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
      sourceDuration: clip.sourceDuration,
    };
  }

  if (mode === 'trim-start') {
    const sourceMinimumStart =
      clip.sourceType === 'image'
        ? 0
        : clip.startTime - clip.inPoint;
    const startTime = roundTime(
      clamp(
        clip.startTime + deltaTime,
        Math.max(0, previousEnd, sourceMinimumStart),
        originalEnd - MIN_DURATION
      )
    );
    const duration = roundTime(originalEnd - startTime);
    const inPoint =
      clip.sourceType === 'image'
        ? 0
        : roundTime(clip.inPoint + (startTime - clip.startTime));
    return {
      id: clip.id,
      startTime,
      duration,
      inPoint,
      outPoint: clip.sourceType === 'image' ? duration : clip.outPoint,
      sourceDuration:
        clip.sourceType === 'image' ? duration : clip.sourceDuration,
    };
  }

  const sourceMaximumEnd =
    clip.sourceType === 'image'
      ? Number.POSITIVE_INFINITY
      : clip.startTime + (clip.sourceDuration - clip.inPoint);
  const endTime = roundTime(
    clamp(
      originalEnd + deltaTime,
      clip.startTime + MIN_DURATION,
      Math.min(nextStart, sourceMaximumEnd)
    )
  );
  const duration = roundTime(endTime - clip.startTime);
  return {
    id: clip.id,
    startTime: clip.startTime,
    duration,
    inPoint: clip.inPoint,
    outPoint:
      clip.sourceType === 'image'
        ? duration
        : roundTime(clip.inPoint + duration),
    sourceDuration:
      clip.sourceType === 'image' ? duration : clip.sourceDuration,
  };
}
