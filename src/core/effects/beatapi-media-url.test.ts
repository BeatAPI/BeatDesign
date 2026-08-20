import assert from 'node:assert/strict';
import test from 'node:test';

import { isOfficialBeatApiMediaUrl } from './beatapi-media-url';

test('allows only the official BeatAPI media origin', () => {
  assert.equal(
    isOfficialBeatApiMediaUrl(
      'https://media.beatapi.io/outputs/task_123/result.mp4'
    ),
    true
  );

  for (const url of [
    'http://media.beatapi.io/output.mp4',
    'https://media.beatapi.io.evil.example/output.mp4',
    'https://127.0.0.1/output.mp4',
    'https://media.beatapi.io:8443/output.mp4',
    'https://user:pass@media.beatapi.io/output.mp4',
    'not-a-url',
  ]) {
    assert.equal(isOfficialBeatApiMediaUrl(url), false, url);
  }
});
