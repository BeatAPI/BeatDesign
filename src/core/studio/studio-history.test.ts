import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatStudioHistoryDateTime,
  getStudioHistoryMediaFrame,
} from './studio-history';

test('formats history date and time together', () => {
  assert.equal(
    formatStudioHistoryDateTime(new Date(2026, 2, 25, 14, 34)),
    '03-25 14:34'
  );
});

test('sizes history media to the stored aspect ratio', () => {
  assert.deepEqual(getStudioHistoryMediaFrame('16:9'), {
    aspectRatio: '16 / 9',
    orientation: 'landscape',
  });
  assert.deepEqual(getStudioHistoryMediaFrame('9:16'), {
    aspectRatio: '9 / 16',
    orientation: 'portrait',
  });
  assert.equal(getStudioHistoryMediaFrame('1:1').orientation, 'square');
  assert.equal(
    getStudioHistoryMediaFrame(null, { width: 1920, height: 1080 })
      .orientation,
    'landscape'
  );
});
