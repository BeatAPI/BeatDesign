import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOutputStoragePlan,
  shouldRetryOutputStorageSync,
} from './output-storage';

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

test('stores video covers as thumbnails without replacing the main output asset', () => {
  assert.deepEqual(
    buildOutputStoragePlan({
      effectType: 1,
      output: {
        video_url: 'https://media.beatapi.io/outputs/task-1/result.mp4',
        cover_url: 'https://media.beatapi.io/outputs/task-1/cover.jpg',
      },
    }),
    [
      {
        url: 'https://media.beatapi.io/outputs/task-1/result.mp4',
        type: 'video',
        role: 'output',
      },
      {
        url: 'https://media.beatapi.io/outputs/task-1/cover.jpg',
        type: 'image',
        role: 'thumbnail',
      },
    ]
  );
});
