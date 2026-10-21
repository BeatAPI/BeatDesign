import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { getCachedVideoThumbnail } from './video-thumbnail-cache';

const jpeg = Uint8Array.from([0xff, 0xd8, 1, 2, 0xff, 0xd9]);

test('poster cache persists once, coalesces requests, and invalidates changed sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'beatdesign-posters-'));
  try {
    const filePath = join(root, 'source.mp4');
    await writeFile(filePath, 'source');
    let calls = 0;
    const render = async () => { calls++; return jpeg; };
    const options = { filePath, assetId: 'video-a', cacheRoot: join(root, 'cache'), render };
    const first = await Promise.all(Array.from({ length: 5 }, () => getCachedVideoThumbnail(options)));
    assert.equal(calls, 1);
    assert.equal(new Set(first.map((result) => result.key)).size, 1);
    const reused = await getCachedVideoThumbnail({ ...options, render: async () => { throw new Error('must use disk cache'); } });
    assert.equal(reused.cached, true);
    assert.deepEqual(reused.bytes, jpeg);
    await writeFile(filePath, 'changed source content');
    const changed = await getCachedVideoThumbnail(options);
    assert.notEqual(changed.key, first[0].key);
    assert.equal(calls, 2);
    assert.ok((await readdir(options.cacheRoot)).every((file) => file.endsWith('.jpg')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed thumbnail jobs do not poison the cache or leave in-flight work behind', async () => {
  const root = await mkdtemp(join(tmpdir(), 'beatdesign-posters-fail-'));
  try {
    const filePath = join(root, 'source.mp4');
    await writeFile(filePath, 'source');
    const options = { filePath, assetId: 'video-a', cacheRoot: join(root, 'cache') };
    await assert.rejects(getCachedVideoThumbnail({ ...options, render: async () => { throw new Error('decoder unavailable'); } }), /decoder unavailable/);
    const retry = await getCachedVideoThumbnail({ ...options, render: async () => jpeg });
    assert.deepEqual(retry.bytes, jpeg);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('poster decoding is limited to two jobs even for different videos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'beatdesign-posters-queue-'));
  try {
    const filePath = join(root, 'source.mp4');
    await writeFile(filePath, 'source');
    let active = 0;
    let peak = 0;
    const render = async () => {
      peak = Math.max(peak, ++active);
      await new Promise((done) => setTimeout(done, 20));
      active--;
      return jpeg;
    };
    await Promise.all(Array.from({ length: 5 }, (_, index) => getCachedVideoThumbnail({ filePath, assetId: `video-${index}`, cacheRoot: root, render })));
    assert.equal(peak, 2);
    assert.equal(active, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

const hasFfmpeg = spawnSync(process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
test('real video decoder produces a small cached JPEG without ffprobe', { skip: !hasFfmpeg }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'beatdesign-posters-real-'));
  try {
    const poster = await getCachedVideoThumbnail({ filePath: resolve('tests/fixtures/tiny-black.mp4'), assetId: 'real-video', cacheRoot: root });
    assert.deepEqual(Array.from(poster.bytes.slice(0, 2)), [0xff, 0xd8]);
    assert.ok(poster.bytes.length < 100_000);
    assert.equal((await getCachedVideoThumbnail({ filePath: resolve('tests/fixtures/tiny-black.mp4'), assetId: 'real-video', cacheRoot: root })).cached, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
