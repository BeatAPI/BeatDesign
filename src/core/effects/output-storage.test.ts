import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRetryOutputStorageSync } from './output-storage';

test('provider-owned output URLs do not require a second storage sync', () => {
  assert.equal(
    shouldRetryOutputStorageSync({
      providerStatus: 'succeeded',
      output: { storage_sync_failed: true },
    }),
    false
  );
  assert.equal(
    shouldRetryOutputStorageSync({
      providerStatus: 'processing',
      output: { storage_sync_failed: true },
    }),
    false
  );
  assert.equal(
    shouldRetryOutputStorageSync({
      providerStatus: 'succeeded',
      output: { storage_sync_failed: false },
    }),
    false
  );
});
