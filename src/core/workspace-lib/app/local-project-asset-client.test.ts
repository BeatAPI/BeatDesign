import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from '@/lib/trusted-local-request';
import { uploadLocalProjectAsset } from './local-project-asset-client';

test('uploads imported media immediately with trusted multipart request headers', async () => {
  const file = new File(['image-bytes'], 'reference.png', { type: 'image/png' });
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const asset = await uploadLocalProjectAsset({
    projectId: 'project 1',
    file,
    assetClass: 'derived',
    width: 1920,
    height: 1080,
    durationMs: 3600,
    metadata: { operation: 'timeline_extract', sourceInSec: 3.2 },
    fetchImpl: (async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Response.json({
        asset: {
          id: 'asset-1',
          type: 'image',
          publicUrl: '/api/app/projects/project%201/assets/asset-1',
          filename: 'reference.png',
          mimeType: 'image/png',
          sizeBytes: file.size,
        },
      });
    }) as typeof fetch,
  });

  assert.equal(capturedUrl, '/api/app/projects/project%201/assets');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(
    new Headers(capturedInit?.headers).get(WORKSPACE_MUTATION_HEADER),
    WORKSPACE_MUTATION_HEADER_VALUE
  );
  assert.equal(new Headers(capturedInit?.headers).has('content-type'), false);
  assert.ok(capturedInit?.body instanceof FormData);
  const body = capturedInit?.body as FormData;
  assert.equal(body.get('assetClass'), 'derived');
  assert.equal(body.get('width'), '1920');
  assert.equal(body.get('height'), '1080');
  assert.equal(body.get('durationMs'), '3600');
  assert.equal(
    body.get('metadata'),
    JSON.stringify({ operation: 'timeline_extract', sourceInSec: 3.2 })
  );
  assert.equal(asset.id, 'asset-1');
});
