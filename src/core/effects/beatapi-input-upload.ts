import {
  isOfficialBeatApiInputUrl,
  isOfficialBeatApiMediaUrl,
} from './beatapi-media-url';

const MAX_MOTION_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_MOTION_VIDEO_BYTES = 100 * 1024 * 1024;
const BEATAPI_FILE_TIMEOUT_MS = 120_000;

type MotionControlAssetKind = 'image' | 'video';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

const filenameFromUrl = (url: string, kind: MotionControlAssetKind) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const sanitized = name.replace(/[^\w.\-]+/g, '_');
    if (sanitized) return sanitized;
  } catch {
    // fall through to the kind default
  }
  return kind === 'image' ? 'character.png' : 'motion.mp4';
};

const maxBytesForKind = (kind: MotionControlAssetKind) =>
  kind === 'image' ? MAX_MOTION_IMAGE_BYTES : MAX_MOTION_VIDEO_BYTES;

export const uploadBeatApiInputFile = async ({
  baseUrl,
  apiKey,
  body,
  contentType,
  filename,
}: {
  baseUrl: string;
  apiKey: string;
  body: Blob;
  contentType: string;
  filename: string;
}) => {
  const formData = new FormData();
  formData.set('file', new File([body], filename, { type: contentType }), filename);
  formData.set('purpose', 'input');
  const response = await fetch(`${baseUrl}/v1/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(BEATAPI_FILE_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const root = asRecord(payload);
    const error = asRecord(root?.error);
    throw new Error(
      readString(error?.message) ??
        readString(root?.message) ??
        'BeatAPI file upload failed'
    );
  }
  const data = asRecord(asRecord(payload)?.data) ?? asRecord(payload);
  const url = readString(data?.url);
  if (!url || !isOfficialBeatApiInputUrl(url)) {
    throw new Error('BeatAPI upload response is incomplete');
  }
  return url;
};

export const ensureBeatApiInputUrl = async ({
  url,
  kind,
  baseUrl,
  apiKey,
}: {
  url: string;
  kind: MotionControlAssetKind;
  baseUrl: string;
  apiKey: string;
}) => {
  if (isOfficialBeatApiInputUrl(url)) return url;
  if (!isOfficialBeatApiMediaUrl(url)) {
    throw new Error(
      'Kling Motion Control inputs must be uploaded through the connected BeatAPI account'
    );
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(BEATAPI_FILE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error('Failed to download generated media for Motion Control');
  }

  const declaredLength = Number(response.headers.get('content-length'));
  const maxBytes = maxBytesForKind(kind);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(
      kind === 'image'
        ? 'Kling Motion Control images must be 10 MB or smaller'
        : 'Kling Motion Control videos must be 100 MB or smaller'
    );
  }

  const blob = await response.blob();
  if (blob.size > maxBytes) {
    throw new Error(
      kind === 'image'
        ? 'Kling Motion Control images must be 10 MB or smaller'
        : 'Kling Motion Control videos must be 100 MB or smaller'
    );
  }

  const contentType =
    blob.type ||
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    (kind === 'image' ? 'image/png' : 'video/mp4');

  return uploadBeatApiInputFile({
    baseUrl,
    apiKey,
    body: blob,
    contentType,
    filename: filenameFromUrl(url, kind),
  });
};

export const ensureMotionControlInputUrls = async ({
  imageUrl,
  videoUrl,
  baseUrl,
  apiKey,
}: {
  imageUrl: string;
  videoUrl: string;
  baseUrl: string;
  apiKey: string;
}) => {
  const [image, video] = await Promise.all([
    ensureBeatApiInputUrl({ url: imageUrl, kind: 'image', baseUrl, apiKey }),
    ensureBeatApiInputUrl({ url: videoUrl, kind: 'video', baseUrl, apiKey }),
  ]);
  return { imageUrl: image, videoUrl: video };
};
