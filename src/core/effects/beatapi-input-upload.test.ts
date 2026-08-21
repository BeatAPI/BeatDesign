import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureBeatApiInputUrl } from './beatapi-input-upload';

test('keeps official BeatAPI input URLs and rehosts generated outputs', async () => {
  const inputUrl = 'https://media.beatapi.io/inputs/character.png';
  assert.equal(
    await ensureBeatApiInputUrl({
      url: inputUrl,
      kind: 'image',
      baseUrl: 'https://api.beatapi.io',
      apiKey: 'sk-test',
    }),
    inputUrl
  );

  const originalFetch = globalThis.fetch;
  const uploadedUrl = 'https://media.beatapi.io/inputs/file_1.png';
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/outputs/')) {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
      });
    }
    if (url.endsWith('/v1/files')) {
      return Response.json(
        { data: { id: 'file_1', url: uploadedUrl, key: 'inputs/file_1.png' } },
        { status: 201 }
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    assert.equal(
      await ensureBeatApiInputUrl({
        url: 'https://media.beatapi.io/outputs/task/result.png',
        kind: 'image',
        baseUrl: 'https://api.beatapi.io',
        apiKey: 'sk-test',
      }),
      uploadedUrl
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects Motion Control media that is not on the official BeatAPI origin', async () => {
  await assert.rejects(
    () =>
      ensureBeatApiInputUrl({
        url: 'https://example.com/character.png',
        kind: 'image',
        baseUrl: 'https://api.beatapi.io',
        apiKey: 'sk-test',
      }),
    /connected BeatAPI account/
  );
});
