import assert from 'node:assert/strict';
import test from 'node:test';

import {
  build16688GeminiImageRequest,
  build16688ImageRequest,
  normalize16688GeminiImageResponse,
  normalize16688ImageResponse,
  validate16688ImageInput,
} from './newapi-16688-adapter';

test('maps wide and portrait canvas requests to OpenAI image sizes', () => {
  assert.deepEqual(
    build16688ImageRequest({
      model: 'gpt-image-2.5-flare',
      input: { prompt: '  Neon city at night  ', aspect_ratio: '16:9' },
    }),
    {
      model: 'gpt-image-2.5-flare',
      prompt: 'Neon city at night',
      n: 1,
      size: '1536x1024',
      response_format: 'b64_json',
    }
  );
  assert.equal(
    build16688ImageRequest({
      model: 'gpt-image-2',
      input: { prompt: 'Poster', aspect_ratio: '9:16' },
    }).size,
    '1024x1536'
  );
});

test('maps Gemini image requests to the native generateContent shape', () => {
  assert.deepEqual(
    build16688GeminiImageRequest({
      input: {
        prompt: '  Product photo on a marble table  ',
        aspect_ratio: '4:3',
        wmOutputQuality: '2k',
      },
    }),
    {
      systemInstruction: { parts: [{ text: 'Return an image only.' }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Product photo on a marble table' }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '4:3', imageSize: '2K' },
      },
    }
  );
});

test('normalizes only inline images from 16688 AI', () => {
  assert.deepEqual(
    normalize16688ImageResponse({
      data: [{ b64_json: 'aGVsbG8=' }],
      usage: { total_tokens: 10 },
    }),
    {
      status: 'succeeded',
      output: {
        provider: '16688',
        result_url: 'data:image/png;base64,aGVsbG8=',
        resultUrls: ['data:image/png;base64,aGVsbG8='],
        image_urls: ['data:image/png;base64,aGVsbG8='],
        usage: { total_tokens: 10 },
      },
    }
  );
  assert.equal(
    normalize16688ImageResponse({ data: [{ url: 'https://untrusted.test/a.png' }] })
      .status,
    'failed'
  );
});

test('normalizes only bounded inline Gemini image media', () => {
  assert.deepEqual(
    normalize16688GeminiImageResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/webp',
                  data: 'aGVsbG8=',
                },
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 12 },
    }),
    {
      status: 'succeeded',
      output: {
        provider: '16688',
        result_url: 'data:image/webp;base64,aGVsbG8=',
        resultUrls: ['data:image/webp;base64,aGVsbG8='],
        image_urls: ['data:image/webp;base64,aGVsbG8='],
        usage: { totalTokenCount: 12 },
      },
    }
  );
  assert.equal(
    normalize16688GeminiImageResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/octet-stream',
                  data: 'aGVsbG8=',
                },
              },
            ],
          },
        },
      ],
    }).status,
    'failed'
  );
});

test('prototype rejects references and non-image effects before submission', () => {
  assert.throws(
    () =>
      build16688ImageRequest({
        model: 'gpt-image-2',
        input: {
          prompt: 'Restyle',
          image_urls: ['https://example.com/input.png'],
        },
      }),
    /text-to-image only/
  );
  assert.throws(
    () =>
      build16688GeminiImageRequest({
        input: {
          prompt: 'Restyle',
          image_urls: ['https://example.com/input.png'],
        },
      }),
    /Gemini text-to-image only/
  );
  assert.throws(
    () => validate16688ImageInput({ effectType: 1, input: { prompt: 'Video' } }),
    /image generation only/
  );
});
