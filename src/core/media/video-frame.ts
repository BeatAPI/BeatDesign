export type ExtractedVideoFrame = {
  file: File;
  width: number;
  height: number;
  timeSeconds: number;
  durationSeconds: number;
};

const FRAME_EPSILON_SECONDS = 1 / 30;

export const resolveVideoFrameTimestamp = ({
  durationSeconds,
  position,
}: {
  durationSeconds: number;
  position: 'first' | 'last' | number;
}) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Video duration is unavailable');
  }
  if (position === 'first') return Math.min(0.05, durationSeconds / 2);
  if (position === 'last') {
    return Math.max(0, durationSeconds - FRAME_EPSILON_SECONDS);
  }
  if (!Number.isFinite(position)) throw new Error('Frame time is invalid');
  return Math.max(0, Math.min(durationSeconds - FRAME_EPSILON_SECONDS, position));
};

const waitForVideoEvent = (
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'seeked'
) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, handleSuccess);
      video.removeEventListener('error', handleError);
    };
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Video frame could not be decoded'));
    };
    video.addEventListener(eventName, handleSuccess, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });

const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Video frame could not be encoded'));
    }, 'image/png');
  });

export async function extractVideoFrame({
  url,
  position = 'last',
  filename = 'video-tail-frame.png',
}: {
  url: string;
  position?: 'first' | 'last' | number;
  filename?: string;
}): Promise<ExtractedVideoFrame> {
  if (typeof document === 'undefined') {
    throw new Error('Video frame extraction requires the local browser runtime');
  }
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  const cleanup = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  };

  try {
    const metadataReady = waitForVideoEvent(video, 'loadedmetadata');
    video.src = url;
    video.load();
    await metadataReady;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error('Video dimensions are unavailable');
    }
    const timeSeconds = resolveVideoFrameTimestamp({
      durationSeconds: video.duration,
      position,
    });
    const seekReady = waitForVideoEvent(video, 'seeked');
    video.currentTime = timeSeconds;
    await seekReady;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToPngBlob(canvas);
    return {
      file: new File([blob], filename, { type: 'image/png' }),
      width: canvas.width,
      height: canvas.height,
      timeSeconds,
      durationSeconds: video.duration,
    };
  } finally {
    cleanup();
  }
}
