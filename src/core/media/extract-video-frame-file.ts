import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { resolveVideoFrameTimestamp } from './video-frame';

export type ExtractedVideoFrameFile = {
  bytes: Uint8Array;
  mimeType: 'image/png';
  width: number;
  height: number;
  timeSeconds: number;
  durationSeconds: number;
};

const runProcess = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.trim() || `${command} failed with exit code ${code ?? 'unknown'}.`
        )
      );
    });
  });

const readPngSize = (bytes: Uint8Array) => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.byteLength < 24 ||
    signature.some((value, index) => bytes[index] !== value)
  ) {
    throw new Error('Extracted frame is not a PNG.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1 || height < 1) throw new Error('Extracted PNG dimensions are invalid.');
  return { width, height };
};

const ffmpegBin = () => process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg';

async function extractWithFfmpeg({
  filePath,
  timeSeconds,
  tailWindowSeconds,
  decodeToEnd = false,
}: {
  filePath: string;
  timeSeconds: number;
  tailWindowSeconds?: number;
  decodeToEnd?: boolean;
}) {
  const directory = await mkdtemp(join(tmpdir(), 'beatdesign-frame-'));
  const outputPath = join(directory, 'frame.png');
  try {
    const seekArgs = tailWindowSeconds
      ? ['-sseof', `-${tailWindowSeconds.toFixed(3)}`]
      : decodeToEnd
        ? []
        : ['-ss', timeSeconds.toFixed(3)];
    await runProcess(
      ffmpegBin(),
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        ...seekArgs,
        '-i',
        filePath,
        '-map',
        '0:v:0',
        ...(tailWindowSeconds || decodeToEnd ? [] : ['-frames:v', '1']),
        '-update',
        '1',
        outputPath,
      ]
    );
    const bytes = new Uint8Array(await readFile(outputPath));
    const size = readPngSize(bytes);
    return { bytes, ...size };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readVideoDuration(filePath: string) {
  const { ALL_FORMATS, FilePathSource, Input } = await import('mediabunny');
  const input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });
  try {
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Video duration is unavailable');
    }
    return duration;
  } finally {
    input.dispose();
  }
}

export async function extractVideoFrameFromFile({
  filePath,
  position = 'last',
}: {
  filePath: string;
  position?: 'first' | 'last' | number;
}): Promise<ExtractedVideoFrameFile> {
  const durationSeconds = await readVideoDuration(filePath);
  const timeSeconds = resolveVideoFrameTimestamp({
    durationSeconds,
    position,
  });
  try {
    let extracted;
    if (position === 'last') {
      try {
        extracted = await extractWithFfmpeg({
          filePath,
          timeSeconds,
          tailWindowSeconds: Math.min(1, durationSeconds),
        });
      } catch {
        // A container may outlive its video track because of trailing audio.
        // Decode from the start only as a rare fallback and keep overwriting
        // one PNG so the final decoded video frame wins.
        extracted = await extractWithFfmpeg({
          filePath,
          timeSeconds,
          decodeToEnd: true,
        });
      }
    } else {
      extracted = await extractWithFfmpeg({ filePath, timeSeconds });
    }
    return {
      bytes: extracted.bytes,
      mimeType: 'image/png',
      width: extracted.width,
      height: extracted.height,
      timeSeconds,
      durationSeconds,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'decoder failed';
    throw new Error(
      `Video frame extraction failed. Ensure ffmpeg is on PATH or set BEATDESIGN_FFMPEG. ${reason}`
    );
  }
}

export async function extractVideoFrameFromBytes({
  bytes,
  filename,
  position = 'last',
}: {
  bytes: Uint8Array;
  filename: string;
  position?: 'first' | 'last' | number;
}) {
  const directory = await mkdtemp(join(tmpdir(), 'beatdesign-frame-src-'));
  const inputPath = join(directory, basename(filename.trim()) || 'source.mp4');
  try {
    await writeFile(inputPath, bytes);
    return extractVideoFrameFromFile({ filePath: inputPath, position });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
