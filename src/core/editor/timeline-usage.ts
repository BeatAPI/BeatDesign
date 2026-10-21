import {
  getTimelineClipSource,
  type TimelineDocument,
} from './timeline-document';

export function getTimelineUsage(
  document: TimelineDocument | null,
  revision: number | null
) {
  return {
    timelineRevision: revision,
    clips:
      document?.tracks.flatMap((track) =>
        track.clips.map((clip) => {
          const source = getTimelineClipSource(clip);
          return {
            trackId: track.id,
            clipId: clip.id,
            sourceType: clip.sourceType,
            sourceUrl: clip.sourceType === 'caption' ? null : source.sourceUrl,
            assetId: clip.sourceType === 'caption' ? null : source.assetId,
            takeId: source.take?.id ?? null,
            name: clip.name,
            timelineStart: clip.startTime,
            duration: clip.duration,
            sourceIn: source.inPoint,
            sourceOut: source.outPoint,
            hidden: track.hidden,
            muted: track.muted || clip.muted,
          };
        })
      ) ?? [],
  };
}
