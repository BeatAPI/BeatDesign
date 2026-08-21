import { createFileRoute } from '@tanstack/react-router';
import { readFile } from 'node:fs/promises';

import {
  LOCAL_PROJECT_ASSET_BUCKET,
  LOCAL_PROJECT_ASSET_PROVIDER,
  resolveLocalProjectAssetPath,
} from '@/core/projects/local-project-assets';
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

  let bytes: Uint8Array;
  try {
    bytes = await readFile(
      resolveLocalProjectAssetPath({ objectKey: asset.objectKey })
    );
  } catch {
    return Response.json({ error: 'Project asset file is missing' }, { status: 404 });
  }

  const headers = new Headers({
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=31536000, immutable',
    'content-type': asset.mimeType || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  const rangeHeader = request.headers.get('range');
  const range = parseByteRange(rangeHeader, bytes.byteLength);
  if (rangeHeader && !range) {
    headers.set('content-range', `bytes */${bytes.byteLength}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    const body = Uint8Array.from(bytes.subarray(range.start, range.end + 1));
    headers.set('content-length', String(body.byteLength));
    headers.set(
      'content-range',
      `bytes ${range.start}-${range.end}/${bytes.byteLength}`
    );
    return new Response(body.buffer, { status: 206, headers });
  }

  headers.set('content-length', String(bytes.byteLength));
  return new Response(Uint8Array.from(bytes).buffer, { status: 200, headers });
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/assets/$assetId'
)({
  server: { handlers: { GET } },
});
