import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readResponseBodyWithLimit,
  readResponseJsonWithLimit,
  ResponseBodyTooLargeError,
} from './response-body-limit';

test('rejects a streamed provider response once it exceeds the limit', async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    })
  );

  await assert.rejects(
    readResponseBodyWithLimit(response, 10),
    ResponseBodyTooLargeError
  );
});

test('parses a bounded provider JSON response', async () => {
  const response = Response.json({ data: { url: 'https://cdn.example/result.mp4' } });
  assert.deepEqual(await readResponseJsonWithLimit(response, 1024), {
    data: { url: 'https://cdn.example/result.mp4' },
  });
});
