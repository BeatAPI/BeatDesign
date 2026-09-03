import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { extractVideoFrameFromFile } from './extract-video-frame-file';

const hasFfmpeg = spawnSync(
  process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg',
  ['-version'],
  { stdio: 'ignore' }
).status === 0;

test(
  'extracts the true tail frame from a 25fps video',
  { skip: !hasFfmpeg },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'beatdesign-frame-test-'));
    const filePath = join(directory, 'sample.mp4');
    const ffmpeg = process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg';
    try {
      execFileSync(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=red:s=64x48:r=25:d=1',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-y',
          filePath,
        ],
        { stdio: 'ignore' }
      );

      const frame = await extractVideoFrameFromFile({
        filePath,
        position: 'last',
      });
      assert.equal(frame.mimeType, 'image/png');
      assert.equal(frame.width, 64);
      assert.equal(frame.height, 48);
      assert.ok(frame.bytes.byteLength > 100);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
);

test(
  'falls back to the final video frame when audio outlives the video track',
  { skip: !hasFfmpeg },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'beatdesign-frame-test-'));
    const filePath = join(directory, 'audio-tail.mp4');
    const ffmpeg = process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg';
    try {
      execFileSync(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=red:s=64x48:r=25:d=1',
          '-f',
          'lavfi',
          '-i',
          'anullsrc=r=48000:cl=stereo:d=3',
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-t',
          '3',
          '-y',
          filePath,
        ],
        { stdio: 'ignore' }
      );

      const frame = await extractVideoFrameFromFile({
        filePath,
        position: 'last',
      });
      assert.equal(frame.width, 64);
      assert.equal(frame.height, 48);
      assert.ok(frame.bytes.byteLength > 100);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
);
