export const STATIC_VIDEO_PREVIEW_TIME_SECONDS = 1;
export const STATIC_VIDEO_PREVIEW_MAX_EDGE = 512;

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

export function getStaticVideoPreviewSize(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge = STATIC_VIDEO_PREVIEW_MAX_EDGE
) {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    !Number.isFinite(maxEdge) ||
    maxEdge <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function captureStaticVideoPreview(
  video: HTMLVideoElement,
  maxEdge = STATIC_VIDEO_PREVIEW_MAX_EDGE
) {
  if (typeof document === 'undefined' || video.readyState < 2) return null;

  const targetTime = getStaticVideoPreviewTime(video.duration);
  if (Math.abs(video.currentTime - targetTime) > 0.12) return null;

  const size = getStaticVideoPreviewSize(
    video.videoWidth,
    video.videoHeight,
    maxEdge
  );
  if (size.width === 0 || size.height === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, size.width, size.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  } catch {
    // Cross-origin media can reject canvas capture. The caller keeps its
    // non-black loading surface instead of exposing a broken video layer.
    return null;
  }
}
