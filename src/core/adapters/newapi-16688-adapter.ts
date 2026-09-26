import { z } from 'zod';

import { getConfig } from '@/modules/config/service';
import { BaseAdapter, type GenerationResult } from './base-adapter';

export const DEFAULT_16688_API_BASE_URL = 'https://api.16688.org';

const REQUEST_TIMEOUT_MS = 180_000;
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024;

const inputSchema = z.object({
  prompt: z.string().min(1),
  aspect_ratio: z.string().optional(),
  wmOutputQuality: z.string().optional(),
  image_urls: z.array(z.string().url()).optional(),
  image_url: z.string().url().optional(),
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : null;

const mapAspectRatioToOpenAiSize = (aspectRatio?: string) => {
  if (!aspectRatio || aspectRatio === 'auto') return 'auto';
  const [width, height] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) {
    return 'auto';
  }
  const ratio = width / height;
  if (ratio > 1.15) return '1536x1024';
  if (ratio < 0.87) return '1024x1536';
  return '1024x1024';
};

export const build16688ImageRequest = ({
  model,
  input,
}: {
  model: string;
  input: z.infer<typeof inputSchema>;
}) => {
  const references = input.image_urls?.length
    ? input.image_urls
    : input.image_url
      ? [input.image_url]
      : [];
  if (references.length > 0) {
    throw new Error(
      '16688 Studio prototype currently supports text-to-image only. Remove image references and try again.'
    );
  }

  return {
    model,
    prompt: input.prompt.trim(),
    n: 1,
    size: mapAspectRatioToOpenAiSize(input.aspect_ratio),
    response_format: 'b64_json',
  };
};

export const normalize16688ImageResponse = (
  payload: unknown
): GenerationResult => {
  const root = asRecord(payload);
  const items = Array.isArray(root?.data) ? root.data : [];
  const images = items.flatMap((item) => {
    const record = asRecord(item);
    const base64 = readString(record?.b64_json);
    return base64 ? [`data:image/png;base64,${base64}`] : [];
  });
  if (images.length === 0) {
    return {
      status: 'failed',
      error: '16688 AI did not return an inline image.',
    };
  }

  return {
    status: 'succeeded',
    output: {
      provider: '16688',
      result_url: images[0],
      resultUrls: images,
      image_urls: images,
      ...(root?.usage !== undefined ? { usage: root.usage } : {}),
    },
  };
};

const readBoundedJson = async (response: Response) => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('16688 AI response exceeded the 40 MB limit.');
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('16688 AI response exceeded the 40 MB limit.');
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

export const validate16688ImageInput = ({
  effectType,
  input,
}: {
  effectType: number;
  input: Record<string, unknown>;
}) => {
  if (effectType !== 2) {
    throw new Error('The 16688 Studio prototype supports image generation only.');
  }
  const unknownKeys = Object.keys(input).filter(
    (key) => !(key in inputSchema.shape)
  );
  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported model parameters: ${unknownKeys.join(', ')}`);
  }
  return inputSchema.parse(input);
};

export class NewApi16688Adapter extends BaseAdapter {
  async createGeneration(input: unknown): Promise<GenerationResult> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'failed',
        error: parsed.error.issues[0]?.message || 'Invalid input',
      };
    }

    try {
      const apiKey = await getConfig('NEWAPI_API_KEY');
      if (!apiKey) throw new Error('Connect a 16688 AI API key before generating.');
      const body = build16688ImageRequest({
        model: this.effect.model,
        input: parsed.data,
      });
      const response = await fetch(
        `${DEFAULT_16688_API_BASE_URL}/v1/images/generations`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );
      const payload = await readBoundedJson(response);
      if (!response.ok) {
        const root = asRecord(payload);
        const error = asRecord(root?.error);
        throw new Error(
          readString(error?.message) ??
            readString(root?.message) ??
            `16688 AI request failed with status ${response.status}`
        );
      }
      return normalize16688ImageResponse(payload);
    } catch (cause) {
      return {
        status: 'failed',
        error: cause instanceof Error ? cause.message : '16688 AI generation failed',
      };
    }
  }
}
