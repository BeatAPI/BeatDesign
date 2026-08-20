import assert from 'node:assert/strict';
import test from 'node:test';

import { validateStorageEndpoint } from './endpoint-policy';

test('storage endpoints require a safe HTTPS authority', () => {
  assert.deepEqual(validateStorageEndpoint('https://account.r2.cloudflarestorage.com/'), {
    ok: true,
    endpoint: 'https://account.r2.cloudflarestorage.com',
  });

  for (const endpoint of [
    'http://storage.example.com',
    'https://user:pass@storage.example.com',
    'https://127.0.0.1:9000',
    'https://169.254.169.254',
    'https://10.0.0.1',
    'https://minio.local',
  ]) {
    assert.equal(validateStorageEndpoint(endpoint).ok, false, endpoint);
  }

  assert.equal(
    validateStorageEndpoint('https://10.0.0.1:9000', { allowPrivate: true }).ok,
    true
  );
});
