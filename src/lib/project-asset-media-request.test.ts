import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeProjectAssetMediaRequest,
  shouldNormalizeProjectAssetMediaRequest,
} from './project-asset-media-request';

test('normalizes browser media destinations for dynamic project assets', () => {
  const request = new Request(
    'http://127.0.0.1:3020/api/app/projects/project-1/assets/asset-1',
    { headers: { range: 'bytes=0-', 'sec-fetch-dest': 'video' } }
  );
  const normalized = normalizeProjectAssetMediaRequest(request);

  assert.equal(normalized.headers.get('sec-fetch-dest'), null);
  assert.equal(normalized.headers.get('range'), 'bytes=0-');
  assert.equal(normalized.url, request.url);
});

test('leaves ordinary routes and non-media requests unchanged', () => {
  const pageImage = new Request('http://127.0.0.1:3020/logo.png', {
    headers: { 'sec-fetch-dest': 'image' },
  });
  const assetFetch = new Request(
    'http://127.0.0.1:3020/api/app/projects/project-1/assets/asset-1',
    { headers: { 'sec-fetch-dest': 'empty' } }
  );

  assert.equal(normalizeProjectAssetMediaRequest(pageImage), pageImage);
  assert.equal(normalizeProjectAssetMediaRequest(assetFetch), assetFetch);
});

test('recognizes the dev-server project media route before Fetch conversion', () => {
  assert.equal(
    shouldNormalizeProjectAssetMediaRequest({
      method: 'GET',
      url: '/api/app/projects/project-1/assets/asset-1',
      destination: 'video',
    }),
    true
  );
  assert.equal(
    shouldNormalizeProjectAssetMediaRequest({
      method: 'POST',
      url: '/api/app/projects/project-1/assets/asset-1',
      destination: 'video',
    }),
    false
  );
  assert.equal(
    shouldNormalizeProjectAssetMediaRequest({
      method: 'HEAD',
      url: '/api/app/projects/project-1/assets/asset-1',
      destination: 'video',
    }),
    true
  );
});
