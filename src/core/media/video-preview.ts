export const STATIC_VIDEO_PREVIEW_TIME_SECONDS = 1;

export function getStaticVideoPreviewTime(
  duration: number,
  preferredTime = STATIC_VIDEO_PREVIEW_TIME_SECONDS
) {
  if (duration === 0) return 0;
  if (!Number.isFinite(duration)) return Math.max(0, preferredTime);
  return (
    Math.round(
      Math.min(
        Math.max(0, preferredTime),
        Math.max(0, duration - 0.05)
      ) * 1000
    ) / 1000
  );
}

export function seekStaticVideoPreview(
  video: Pick<HTMLVideoElement, 'currentTime' | 'duration'>
) {
  try {
    video.currentTime = getStaticVideoPreviewTime(video.duration);
  } catch {
    // Some remote or not-yet-seekable media rejects programmatic seeking.
  }
}
