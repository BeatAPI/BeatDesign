import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveOutputMedia } from './output-media';

test('extracts creation video and cover URLs from provider output', () => {
  const media = resolveOutputMedia({
    id: 'provider-task-1',
    state: 'success',
    creations: [
      {
        id: 'creation-1',
        url: 'https://cdn.example.com/video.mp4',
        cover_url: 'https://cdn.example.com/cover.jpg',
      },
    ],
  });

  assert.equal(media.resultUrl, 'https://cdn.example.com/video.mp4');
  assert.deepEqual(media.resultUrls, ['https://cdn.example.com/video.mp4']);
  assert.deepEqual(media.videoUrls, ['https://cdn.example.com/video.mp4']);
  assert.equal(media.coverUrl, 'https://cdn.example.com/cover.jpg');
  assert.deepEqual(media.coverUrls, ['https://cdn.example.com/cover.jpg']);
});
