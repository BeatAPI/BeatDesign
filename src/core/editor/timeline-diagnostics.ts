import type { TimelineDocument, TimelineTrack } from './timeline-document';

export type TimelineDiagnosticCode =
  | 'timeline_gap'
  | 'clip_overlap'
  | 'media_missing'
  | 'take_duration_mismatch'
  | 'caption_overlap'
  | 'caption_out_of_video'
  | 'overlay_out_of_video'
  | 'tiny_clip'
  | 'empty_track';

export type TimelineDiagnostic = {
  code: TimelineDiagnosticCode;
  severity: 'error' | 'warning';
  trackId?: string;
  clipId?: string;
  startTime?: number;
  endTime?: number;
};

const byStartTime = <T extends { startTime: number }>(left: T, right: T) =>
  left.startTime - right.startTime;

function diagnoseTrackOverlap(track: TimelineTrack) {
  const diagnostics: TimelineDiagnostic[] = [];
  const clips = [...track.clips].sort(byStartTime);
  for (let index = 1; index < clips.length; index += 1) {
    const previous = clips[index - 1];
    const current = clips[index];
    if (current.startTime < previous.startTime + previous.duration - 0.001) {
      diagnostics.push({
        code: track.kind === 'caption' ? 'caption_overlap' : 'clip_overlap',
        severity: 'error',
        trackId: track.id,
        clipId: current.id,
        startTime: current.startTime,
        endTime: Math.min(
          previous.startTime + previous.duration,
          current.startTime + current.duration
        ),
      });
    }
  }
  return diagnostics;
}

export function diagnoseTimeline(document: TimelineDocument) {
  const diagnostics: TimelineDiagnostic[] = [];

  for (const track of document.tracks) {
    diagnostics.push(...diagnoseTrackOverlap(track));
    for (const clip of track.clips) {
      const source = clip.activeTakeId
        ? clip.takes.find((take) => take.id === clip.activeTakeId)?.sourceUrl
        : clip.sourceUrl;
      if (clip.sourceType !== 'caption' && !source) {
        diagnostics.push({
          code: 'media_missing',
          severity: 'error',
          trackId: track.id,
          clipId: clip.id,
        });
      }
      const activeTake = clip.activeTakeId
        ? clip.takes.find((take) => take.id === clip.activeTakeId)
        : null;
      if (activeTake && activeTake.sourceDuration < clip.duration - 0.05) {
        diagnostics.push({
          code: 'take_duration_mismatch',
          severity: 'error',
          trackId: track.id,
          clipId: clip.id,
          startTime: clip.startTime,
          endTime: clip.startTime + clip.duration,
        });
      }
      if (clip.sourceType !== 'caption' && clip.duration < 0.1) {
        diagnostics.push({
          code: 'tiny_clip',
          severity: 'warning',
          trackId: track.id,
          clipId: clip.id,
        });
      }
    }
  }

  const videoClips = document.tracks
    .filter((track) => track.kind === 'video' && !track.hidden && !track.muted)
    .flatMap((track) => track.clips)
    .sort(byStartTime);
  let visibleVideoEnd = 0;
  for (const clip of videoClips) {
    if (clip.startTime > visibleVideoEnd + 1 / 30) {
      diagnostics.push({
        code: 'timeline_gap',
        severity: 'error',
        trackId: clip.trackId,
        clipId: clip.id,
        startTime: visibleVideoEnd,
        endTime: clip.startTime,
      });
    }
    visibleVideoEnd = Math.max(visibleVideoEnd, clip.startTime + clip.duration);
  }
  if (videoClips.length > 0 && document.duration > visibleVideoEnd + 1 / 30) {
    diagnostics.push({
      code: 'timeline_gap',
      severity: 'error',
      startTime: visibleVideoEnd,
      endTime: document.duration,
    });
  }

  const captionClips = document.tracks
    .filter((track) => track.kind === 'caption' && !track.hidden)
    .flatMap((track) => track.clips);
  if (videoClips.length > 0) {
    const overlayClips = document.tracks
      .filter((track) => track.kind === 'overlay' && !track.hidden && !track.muted)
      .flatMap((track) => track.clips);
    for (const clip of overlayClips) {
      if (
        clip.startTime < videoClips[0].startTime - 0.05 ||
        clip.startTime + clip.duration > visibleVideoEnd + 0.05
      ) {
        diagnostics.push({
          code: 'overlay_out_of_video',
          severity: 'error',
          trackId: clip.trackId,
          clipId: clip.id,
          startTime: clip.startTime,
          endTime: clip.startTime + clip.duration,
        });
      }
    }
    for (const clip of captionClips) {
      if (clip.startTime + clip.duration > visibleVideoEnd + 0.05) {
        diagnostics.push({
          code: 'caption_out_of_video',
          severity: 'warning',
          trackId: clip.trackId,
          clipId: clip.id,
          startTime: visibleVideoEnd,
          endTime: clip.startTime + clip.duration,
        });
      }
    }
  }

  return diagnostics;
}
