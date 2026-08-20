import assert from 'node:assert/strict';
import test from 'node:test';
import { isSupportedRasterImage } from './image-upload-validation';

test('accepts supported raster image signatures', () => {
  assert.equal(
    isSupportedRasterImage(
      'image/png',
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    true
  );
  assert.equal(
    isSupportedRasterImage(
      'image/webp',
      new TextEncoder().encode('RIFF1234WEBP')
    ),
    true
  );
  assert.equal(
    isSupportedRasterImage(
      'image/heic',
      Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    ),
    true
  );
});

test('rejects SVG and files whose contents do not match their image MIME type', () => {
  assert.equal(
    isSupportedRasterImage(
      'image/svg+xml',
      new TextEncoder().encode('<svg onload="alert(1)"></svg>')
    ),
    false
  );
  assert.equal(
    isSupportedRasterImage(
      'image/png',
      new TextEncoder().encode('<svg onload="alert(1)"></svg>')
    ),
    false
  );
});
