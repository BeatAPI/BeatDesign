import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectUploadedMediaType,
  getCanonicalUploadedMediaMimeType,
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

test('rejects active or conflicting declared MIME types despite safe extensions', () => {
  for (const file of [
    { name: 'payload.mp4', type: 'text/html' },
    { name: 'payload.png', type: 'video/mp4' },
    { name: 'payload.mov', type: 'image/png' },
  ]) {
    assert.equal(detectUploadedMediaType(file), null);
    assert.equal(getCanonicalUploadedMediaMimeType(file), null);
  }
});

test('canonicalizes safe declared types and generic browser fallbacks', () => {
  assert.equal(
    getCanonicalUploadedMediaMimeType({ name: 'portrait.jpg', type: 'image/pjpeg' }),
    'image/jpeg'
  );
  assert.equal(
    getCanonicalUploadedMediaMimeType({
      name: 'motion.webm',
      type: 'application/octet-stream',
    }),
    'video/webm'
  );
});
