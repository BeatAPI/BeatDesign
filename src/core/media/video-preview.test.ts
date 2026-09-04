import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
