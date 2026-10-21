import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getBeatDesignDataRoot } from '@/config/data-root';

const MAX_CONCURRENT_DECODES = 2;
const inFlight = new Map<string, Promise<Uint8Array>>();
const waiting: Array<() => void> = [];
let activeDecodes = 0;

async function withDecoderSlot<T>(work: () => Promise<T>) {
  if (activeDecodes >= MAX_CONCURRENT_DECODES) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else activeDecodes++;
  try { return await work(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else activeDecodes--;
  }
}

/** Optional server decoder: lack of ffmpeg never blocks browser playback. */
export function renderVideoThumbnail(filePath: string, timeSeconds: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const child = spawn(process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '1',
      '-protocol_whitelist', 'file,pipe', '-ss', String(timeSeconds), '-i', filePath,
      '-map', '0:v:0', '-frames:v', '1', '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease',
      '-q:v', '4', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const chunks: Buffer[] = [];
    let length = 0;
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Video thumbnail decode timed out'));
    }, 15_000);
    child.stdout.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > 2 * 1024 * 1024) {
        child.kill();
        reject(new Error('Video thumbnail is too large'));
      } else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-2000); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      const bytes = Buffer.concat(chunks);
      if (code === 0 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) resolve(bytes);
      else reject(new Error(stderr || 'Video thumbnail decode failed'));
    });
  });
}

/** A disposable derived-file cache; never changes a Project or its original Asset. */
export async function getCachedVideoThumbnail({
  filePath, assetId, durationMs, cacheRoot = join(getBeatDesignDataRoot(), 'cache', 'video-posters'),
  render = renderVideoThumbnail,
}: {
  filePath: string;
  assetId: string;
  durationMs?: number | null;
  cacheRoot?: string;
  render?: typeof renderVideoThumbnail;
}) {
  const source = await stat(filePath);
  if (!source.isFile()) throw new Error('Video file is missing');
  const key = createHash('sha256').update(JSON.stringify(['poster-v1', assetId, filePath, source.size, source.mtimeMs, durationMs ?? null])).digest('hex');
  const target = join(cacheRoot, `${key}.jpg`);
  try { return { bytes: new Uint8Array(await readFile(target)), key, cached: true }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  let pending = inFlight.get(target);
  if (!pending) {
    pending = withDecoderSlot(async () => {
      const seconds = durationMs && durationMs > 0 ? Math.min(1, Math.max(0, durationMs / 1000 - 0.05)) : 0;
      const bytes = await render(filePath, seconds);
      await mkdir(cacheRoot, { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: 'wx' });
        await rename(temporary, target);
      } finally { await unlink(temporary).catch(() => undefined); }
      return bytes;
    });
    inFlight.set(target, pending);
  }
  try { return { bytes: await pending, key, cached: false }; }
  finally { if (inFlight.get(target) === pending) inFlight.delete(target); }
}
