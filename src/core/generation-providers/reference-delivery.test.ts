import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProviderGenerationAssetUrl,
  needsManagedGenerationReferenceUpload,
} from './reference-delivery';

test('reuses a generated asset provider URL instead of its local workspace URL', () => {
  const asset = {
    publicUrl: '/api/app/projects/project-1/assets/asset-1',
    source: 'provider',
    metadata: {
      providerUrl: 'https://media.beatapi.io/outputs/task-1/0.png',
    },
  };

  assert.equal(
    getProviderGenerationAssetUrl(asset),
    'https://media.beatapi.io/outputs/task-1/0.png'
  );
  assert.equal(needsManagedGenerationReferenceUpload(asset), false);
});

test('uploads local user assets that have no trusted provider URL', () => {
  assert.equal(
    needsManagedGenerationReferenceUpload({
      publicUrl: '/api/app/projects/project-1/assets/asset-2',
      source: 'upload',
      metadata: null,
    }),
    true
  );
});

test('never trusts private or non-provider metadata as a delivery URL', () => {
  for (const asset of [
    {
      publicUrl: '/api/app/projects/project-1/assets/asset-3',
      source: 'provider',
      metadata: { providerUrl: 'http://127.0.0.1:3020/image.png' },
    },
    {
      publicUrl: '/api/app/projects/project-1/assets/asset-4',
      source: 'upload',
      metadata: { providerUrl: 'https://media.beatapi.io/inputs/image.png' },
    },
  ]) {
    assert.equal(getProviderGenerationAssetUrl(asset), null);
    assert.equal(needsManagedGenerationReferenceUpload(asset), true);
  }
});

test('keeps an existing public project asset URL without another upload', () => {
  assert.equal(
    needsManagedGenerationReferenceUpload({
      publicUrl: 'https://cdn.example.com/reference.png',
      source: 'upload',
      metadata: null,
    }),
    false
  );
});
