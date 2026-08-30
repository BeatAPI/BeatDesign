import { createFileRoute } from '@tanstack/react-router';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

import {
  LOCAL_PROJECT_ASSET_BUCKET,
  LOCAL_PROJECT_ASSET_PROVIDER,
  resolveLocalProjectAssetPath,
} from '@/core/projects/local-project-assets';
import { isSafeInlineUploadedMediaMimeType } from '@/core/effects/validation';
import { getProjectAssetById } from '@/core/workspace-lib/assets/user-assets';

const parseByteRange = (header: string | null, size: number) => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const rawStart = match[1];
  const rawEnd = match[2];
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
};

async function GET({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string; assetId: string };
}) {
  const asset = await getProjectAssetById(params);
  if (
    !asset ||
    asset.storageProvider !== LOCAL_PROJECT_ASSET_PROVIDER ||
    asset.bucket !== LOCAL_PROJECT_ASSET_BUCKET
  ) {
    return Response.json({ error: 'Project asset not found' }, { status: 404 });
  }

  const filePath = resolveLocalProjectAssetPath({ objectKey: asset.objectKey });
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(filePath);
  } catch {
    return Response.json({ error: 'Project asset file is missing' }, { status: 404 });
  }

  const safeInlineMimeType = isSafeInlineUploadedMediaMimeType(asset.mimeType)
    ? asset.mimeType
    : null;
  const headers = new Headers({
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=31536000, immutable',
    'content-type': safeInlineMimeType || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  if (!safeInlineMimeType) {
    headers.set('content-disposition', 'attachment');
  }
  const rangeHeader = request.headers.get('range');
  const range = parseByteRange(rangeHeader, fileStat.size);
  if (rangeHeader && !range) {
    headers.set('content-range', `bytes */${fileStat.size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? fileStat.size - 1;
  headers.set('content-length', String(end - start + 1));
  if (range) {
    headers.set('content-range', `bytes ${start}-${end}/${fileStat.size}`);
  }
  const stream = Readable.toWeb(
    createReadStream(filePath, { start, end })
  ) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    status: range ? 206 : 200,
    headers,
  });
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/assets/$assetId'
)({
  server: { handlers: { GET } },
});
