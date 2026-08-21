import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readRequestBodyWithLimit,
  readRequestFormDataWithLimit,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from './request-body-limit';

test('rejects a chunked body as soon as it exceeds the byte limit', async () => {
  const request = new Request('http://127.0.0.1/upload', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  await assert.rejects(
    readRequestBodyWithLimit(request, 10),
    RequestBodyTooLargeError
  );
});

test('parses JSON only after the request stays within the byte limit', async () => {
  const request = new Request('http://127.0.0.1/config', {
    method: 'POST',
    body: JSON.stringify({ apiKey: 'local-only' }),
  });

  assert.deepEqual(await readRequestJsonWithLimit(request, 1024), {
    apiKey: 'local-only',
  });
});

test('parses multipart data only after the raw body stays within the limit', async () => {
  const formData = new FormData();
  formData.set('projectId', 'project-1');
  formData.set('file', new File(['image'], 'image.png', { type: 'image/png' }));
  const request = new Request('http://127.0.0.1/upload', {
    method: 'POST',
    body: formData,
  });

  const parsed = await readRequestFormDataWithLimit(request, 1024);
  assert.equal(parsed.get('projectId'), 'project-1');
  assert.equal((parsed.get('file') as File).name, 'image.png');
});
