import { z } from 'zod';

import { getBeatCanvasProviderServerConfig } from '@/core/beatcanvas/providers/provider-config';
import { ensureMotionControlInputUrls } from '@/core/effects/beatapi-input-upload';
import {
  isOfficialBeatApiMediaUrl,
  isPublicHttpMediaUrl,
} from '@/core/effects/beatapi-media-url';
import { getConfig } from '@/modules/config/service';
import { BaseAdapter, type GenerationResult } from './base-adapter';

const IMAGE_MODELS = new Set([
  'nano-banana',
  'nano-banana-pro',
  'gpt-image-2',
  'seedream-5-pro',
]);

const VIDEO_MODELS = new Set([
  'minimax-h3',
  'seedance-2',
  'seedance-2-fast',
  'seedance-2-mini',
  'veo-3.1',
  'seedance-2.5',
  'kling-3',
  'kling-2.6-motion-control',
  'kling-3-motion-control',
]);

const BEATAPI_REQUEST_TIMEOUT_MS = 30_000;
const MAX_BEATAPI_RESPONSE_BYTES = 1_000_000;

const inputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  aspect_ratio: z.string().optional(),
  wmDuration: z.string().optional(),
  wmOutputQuality: z.string().optional(),
  wmSound: z.boolean().optional(),
  mode: z.enum(['quality', 'fast', 'lite']).optional(),
  image_urls: z.array(z.string().url()).optional(),
  image_url: z.string().url().optional(),
  video_urls: z.array(z.string().url()).optional(),
  audio_urls: z.array(z.string().url()).optional(),
  sourceVideoDurationSeconds: z.number().positive().optional(),
  characterOrientation: z.enum(['image', 'video']).optional(),
  backgroundSource: z.enum(['input_image', 'input_video']).optional(),
});

type BeatApiMedia = {
  type?: unknown;
  url?: unknown;
  mime_type?: unknown;
};

type BeatApiTask = {
  id?: unknown;
  status?: unknown;
  stage?: unknown;
  request_id?: unknown;
  error_code?: unknown;
  error_message?: unknown;
  output?: {
    media?: BeatApiMedia[];
    r2_url?: unknown;
  } | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

const parseDuration = (value: string | undefined) => {
  if (!value) return undefined;
  const duration = Number.parseInt(value.replace(/s$/i, ''), 10);
  return Number.isFinite(duration) ? duration : undefined;
};

const imageUrlsFromInput = (input: z.infer<typeof inputSchema>) =>
  input.image_urls?.length
    ? input.image_urls
    : input.image_url
      ? [input.image_url]
      : [];

const mapImageResolution = (value: string | undefined) => {
  if (value?.toLowerCase() === '4k') return '4K';
  if (value?.toLowerCase() === '2k') return '2K';
  return '1K';
};

const mapMinimaxResolution = (value: string | undefined) =>
  value?.toLowerCase() === '2k' ? '2K' : '768P';

const mapKlingResolution = (value: string | undefined) => {
  const quality = value?.toLowerCase();
  if (quality === '4k') return '4K';
  if (quality === 'pro' || quality === '1080p') return 'pro';
  return 'std';
};

const mapMotionControlResolution = (value: string | undefined) =>
  value?.toLowerCase() === '1080p' || value?.toLowerCase() === 'pro'
    ? '1080p'
    : '720p';

const mapVeoQuality = (mode: string | undefined) => {
  if (mode === 'fast') return 'Fast';
  if (mode === 'lite') return 'Lite';
  return 'Quality';
};

const mapVeoResolution = (value: string | undefined) => {
  const quality = value?.toLowerCase();
  if (quality === '4k') return '4k';
  if (quality === '1080p') return '1080p';
  return '720p';
};

export const buildBeatApiTaskRequest = ({
  effectType,
  model,
  input,
}: {
  effectType: number;
  model: string;
  input: z.infer<typeof inputSchema>;
}) => {
  const images = imageUrlsFromInput(input);
  const prompt = input.prompt.trim();

  if (effectType === 2) {
    if (!IMAGE_MODELS.has(model)) {
      throw new Error(`Unsupported BeatAPI image model: ${model}`);
    }

    return {
      path: '/v1/images/tasks',
      body: {
        model,
        prompt,
        ...(images.length > 0 ? { images } : {}),
        ...(input.aspect_ratio ? { aspect_ratio: input.aspect_ratio } : {}),
        ...(model === 'nano-banana-pro' ||
        model === 'gpt-image-2' ||
        model === 'seedream-5-pro'
          ? { resolution: mapImageResolution(input.wmOutputQuality) }
          : {}),
      },
    };
  }

  if (effectType !== 1 || !VIDEO_MODELS.has(model)) {
    throw new Error(`Unsupported BeatAPI video model: ${model}`);
  }

  if (
    model === 'kling-2.6-motion-control' ||
    model === 'kling-3-motion-control'
  ) {
    if (images.length !== 1) {
      throw new Error('Kling Motion Control requires exactly one image');
    }
    if (input.video_urls?.length !== 1) {
      throw new Error('Kling Motion Control requires exactly one motion video');
    }
    if (
      !isPublicHttpMediaUrl(images[0]) ||
      !isPublicHttpMediaUrl(input.video_urls[0])
    ) {
      throw new Error(
        'Kling Motion Control inputs must use public HTTP(S) URLs'
      );
    }
    if (
      input.sourceVideoDurationSeconds !== undefined &&
      (input.sourceVideoDurationSeconds < 3 ||
        input.sourceVideoDurationSeconds > 30)
    ) {
      throw new Error('Kling Motion Control video must be between 3 and 30 seconds');
    }
    const characterOrientation = input.characterOrientation ?? 'video';
    if (
      characterOrientation === 'image' &&
      (input.sourceVideoDurationSeconds ?? 0) > 10
    ) {
      throw new Error(
        'Image orientation supports motion videos up to 10 seconds'
      );
    }

    return {
      path: '/v1/videos/tasks',
      body: {
        model,
        prompt,
        images,
        reference_videos: input.video_urls,
        resolution: mapMotionControlResolution(input.wmOutputQuality),
        character_orientation: characterOrientation,
        ...(model === 'kling-3-motion-control'
          ? { background_source: input.backgroundSource ?? 'input_video' }
          : {}),
      },
    };
  }

  const duration = parseDuration(input.wmDuration);
  const body: Record<string, unknown> = {
    model,
    prompt,
    ...(images.length > 0 ? { images } : {}),
    ...(input.aspect_ratio ? { aspect_ratio: input.aspect_ratio } : {}),
  };

  if (model !== 'veo-3.1') {
    if (duration) body.duration = duration;
  }

  if (model === 'minimax-h3') {
    body.resolution = mapMinimaxResolution(input.wmOutputQuality);
  } else if (model === 'seedance-2' || model === 'seedance-2-fast') {
    body.resolution = input.wmOutputQuality || '720p';
    body.generate_audio = input.wmSound ?? true;
  } else if (model === 'seedance-2-mini') {
    body.resolution = input.wmOutputQuality || '720p';
  } else if (model === 'seedance-2.5') {
    body.resolution = '720p';
    body.generate_audio = input.wmSound ?? true;
  } else if (model === 'veo-3.1') {
    body.resolution = mapVeoResolution(input.wmOutputQuality);
    body.quality = mapVeoQuality(input.mode);
  } else if (model === 'kling-3') {
    body.resolution = mapKlingResolution(input.wmOutputQuality);
    body.sound = input.wmSound ?? true;
  }

  if (model === 'minimax-h3' || model.startsWith('seedance-')) {
    const hasMultimodalRefs = Boolean(
      input.video_urls?.length || input.audio_urls?.length
    );
    if (hasMultimodalRefs) {
      delete body.images;
      if (images.length) body.reference_images = images;
      if (input.video_urls?.length) {
        body.reference_videos = input.video_urls;
      }
      if (input.audio_urls?.length) {
        body.reference_audios = input.audio_urls;
      }
    }
  }

  return { path: '/v1/videos/tasks', body };
};

export const normalizeBeatApiTaskResult = (task: BeatApiTask): GenerationResult => {
  const taskId = readString(task.id);
  if (!taskId) {
    return { status: 'failed', error: 'BeatAPI response did not include a task id' };
  }

  const status = readString(task.status)?.toLowerCase() || 'queued';
  const media = Array.isArray(task.output?.media) ? task.output.media : [];
  const resultUrls = media
    .map((item) => readString(item.url))
    .filter((item): item is string => Boolean(item));
  const r2Url = readString(task.output?.r2_url);
  const untrustedMediaUrl = [...resultUrls, ...(r2Url ? [r2Url] : [])].find(
    (url) => !isOfficialBeatApiMediaUrl(url)
  );
  if (untrustedMediaUrl) {
    return {
      status: 'failed',
      error: 'BeatAPI response included an untrusted media URL',
    };
  }
  const imageUrls = media
    .filter((item) => item.type === 'image')
    .map((item) => readString(item.url))
    .filter((item): item is string => Boolean(item));
  const videoUrls = media
    .filter((item) => item.type === 'video')
    .map((item) => readString(item.url))
    .filter((item): item is string => Boolean(item));
  const resultUrl = r2Url ?? resultUrls[0] ?? null;
  const output = {
    taskId,
    provider: 'beatapi',
    requestId: readString(task.request_id),
    stage: readString(task.stage),
    ...(resultUrl ? { result_url: resultUrl } : {}),
    ...(resultUrls.length ? { resultUrls } : {}),
    ...(imageUrls.length ? { image_urls: imageUrls } : {}),
    ...(videoUrls.length ? { video_urls: videoUrls } : {}),
  };

  if (status === 'succeeded') return { status: 'succeeded', output };
  if (status === 'failed') {
    return {
      status: 'failed',
      output,
      error:
        readString(task.error_message) ??
        readString(task.error_code) ??
        'BeatAPI task failed',
    };
  }
  if (status === 'queued' || status === 'pending') {
    return { status: 'pending', output };
  }
  return { status: 'processing', output };
};

const readBoundedJson = async (response: Response) => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_BEATAPI_RESPONSE_BYTES
  ) {
    throw new Error('BeatAPI response exceeded the 1 MB limit');
  }

  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BEATAPI_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('BeatAPI response exceeded the 1 MB limit');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export class BeatApiAdapter extends BaseAdapter {
  private async resolveConfig() {
    const [baseUrl, apiKey] = await Promise.all([
      getConfig('BEATAPI_API_BASE_URL'),
      getConfig('BEATAPI_API_KEY'),
    ]);
    return getBeatCanvasProviderServerConfig({
      providerId: 'beatapi',
      baseUrl,
      apiKey,
    });
  }

  private async request(path: string, init?: RequestInit) {
    const config = await this.resolveConfig();
    if (!config.apiKey) {
      throw new Error('BEATAPI_API_KEY is not configured');
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(BEATAPI_REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const payload = await readBoundedJson(response);
    if (!response.ok) {
      const root = asRecord(payload);
      const error = asRecord(root?.error);
      throw new Error(
        readString(error?.message) ??
          readString(root?.message) ??
          `BeatAPI request failed with status ${response.status}`
      );
    }

    const root = asRecord(payload);
    const task = asRecord(root?.data);
    if (!task) throw new Error('BeatAPI response did not include task data');
    return task as BeatApiTask;
  }

  async createGeneration(input: unknown): Promise<GenerationResult> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'failed',
        error: parsed.error.issues[0]?.message || 'Invalid input',
      };
    }

    try {
      const model = this.effect.model || '';
      let input = parsed.data;
      if (
        model === 'kling-2.6-motion-control' ||
        model === 'kling-3-motion-control'
      ) {
        const images = imageUrlsFromInput(input);
        if (images.length !== 1 || input.video_urls?.length !== 1) {
          throw new Error(
            images.length !== 1
              ? 'Kling Motion Control requires exactly one image'
              : 'Kling Motion Control requires exactly one motion video'
          );
        }
        const config = await this.resolveConfig();
        if (!config.apiKey) {
          throw new Error('BEATAPI_API_KEY is not configured');
        }
        const resolved = await ensureMotionControlInputUrls({
          imageUrl: images[0],
          videoUrl: input.video_urls[0],
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
        });
        input = {
          ...input,
          image_urls: [resolved.imageUrl],
          video_urls: [resolved.videoUrl],
        };
      }

      const request = buildBeatApiTaskRequest({
        effectType: this.effect.type,
        model,
        input,
      });
      const task = await this.request(request.path, {
        method: 'POST',
        body: JSON.stringify(request.body),
      });
      return normalizeBeatApiTaskResult(task);
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'BeatAPI request failed',
      };
    }
  }

  async checkStatus(taskId: string): Promise<GenerationResult> {
    try {
      return normalizeBeatApiTaskResult(
        await this.request(`/v1/tasks/${encodeURIComponent(taskId)}`)
      );
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'BeatAPI request failed',
      };
    }
  }
}
