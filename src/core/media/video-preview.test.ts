import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStaticVideoPreviewSize,
  getStaticVideoPreviewTime,
  seekStaticVideoPreview,
  STATIC_VIDEO_PREVIEW_TIME_SECONDS,
} from './video-preview';

test('static video previews use the first-second frame', () => {
  assert.equal(STATIC_VIDEO_PREVIEW_TIME_SECONDS, 1);
  assert.equal(getStaticVideoPreviewTime(15), 1);
  assert.equal(getStaticVideoPreviewTime(0.6), 0.55);
  assert.equal(getStaticVideoPreviewTime(0), 0);
  assert.equal(getStaticVideoPreviewTime(Number.POSITIVE_INFINITY), 1);
});

test('static video preview seeking tolerates non-seekable media', () => {
  const video = {
    duration: 15,
    set currentTime(_value: number) {
      throw new Error('not seekable');
    },
    get currentTime() {
      return 0;
    },
  };
  assert.doesNotThrow(() => seekStaticVideoPreview(video));
});

test('static video preview frames are downscaled without changing aspect ratio', () => {
  assert.deepEqual(getStaticVideoPreviewSize(720, 1280), {
    width: 288,
    height: 512,
  });
  assert.deepEqual(getStaticVideoPreviewSize(1920, 1080, 320), {
    width: 320,
    height: 180,
  });
  assert.deepEqual(getStaticVideoPreviewSize(240, 180), {
    width: 240,
    height: 180,
  });
});
