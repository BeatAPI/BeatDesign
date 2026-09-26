import assert from 'node:assert/strict';
import test from 'node:test';

import {
  build16688ImageRequest,
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
    () => validate16688ImageInput({ effectType: 1, input: { prompt: 'Video' } }),
    /image generation only/
  );
});
