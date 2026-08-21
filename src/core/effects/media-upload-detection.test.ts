import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectUploadedMediaType,
  validateUploadedVideoFile,
} from './validation';

test('detects supported images and videos from MIME types', () => {
  assert.equal(
    detectUploadedMediaType({ name: 'portrait.png', type: 'image/png' }),
    'image'
  );
  assert.equal(
    detectUploadedMediaType({ name: 'motion.mp4', type: 'video/mp4' }),
    'video'
  );
});

test('falls back to supported file extensions when browsers omit MIME types', () => {
  assert.equal(
    detectUploadedMediaType({ name: 'portrait.WEBP', type: '' }),
    'image'
  );
  assert.equal(
    detectUploadedMediaType({ name: 'motion.MOV', type: '' }),
    'video'
  );
  assert.equal(
    detectUploadedMediaType({ name: 'notes.txt', type: 'text/plain' }),
    null
  );
});

test('accepts a supported video extension when MIME type is missing', () => {
  assert.deepEqual(
    validateUploadedVideoFile({
      name: 'reference.mov',
      type: '',
      size: 1024,
    }),
    { ok: true }
  );
});
