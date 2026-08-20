import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { generationAssetLink, generationHistory, userAsset } from '@/config/db/schema';
import { resolveOutputMedia } from '@/core/effects/output-media';
import { isOfficialBeatApiMediaUrl } from '@/core/effects/beatapi-media-url';
import { and, desc, eq } from 'drizzle-orm';

const getExtensionFromValue = (value: string | null) => {
  if (!value) return null;

  try {
    const pathname = new URL(value).pathname;
    const filename = pathname.split('/').pop() ?? '';
    if (!filename.includes('.')) return null;
    return filename.split('.').pop()?.toLowerCase() ?? null;
  } catch {
    return null;
  }
};

const getExtensionFromContentType = (contentType: string | null) => {
  if (!contentType) return null;
  if (contentType.includes('image/png')) return 'png';
  if (contentType.includes('image/webp')) return 'webp';
  if (contentType.includes('image/gif')) return 'gif';
  if (contentType.includes('image/jpeg')) return 'jpg';
  if (contentType.includes('video/mp4')) return 'mp4';
  if (contentType.includes('video/webm')) return 'webm';
  return null;
};

type GenerationRecord = {
  id: string;
  output: unknown;
};

type LinkedOutput = {
  publicUrl: string | null;
  type: string | null;
  createdAt: Date | null;
};

const getDownloadUrl = async ({
  taskId,
}: {
  taskId: string;
}) => {
  const db = await getDb();
  const generation = (await db
    .select({
      id: generationHistory.id,
      output: generationHistory.output,
    })
    .from(generationHistory)
    .where(eq(generationHistory.id, taskId))
    .limit(1)) as GenerationRecord[];

  const record = generation[0];
  if (!record) return null;

  const linkedOutputs = (await db
    .select({
      publicUrl: userAsset.publicUrl,
      type: userAsset.type,
      createdAt: userAsset.createdAt,
    })
    .from(generationAssetLink)
    .leftJoin(userAsset, eq(userAsset.id, generationAssetLink.assetId))
    .where(
      and(
        eq(generationAssetLink.generationId, taskId),
        eq(generationAssetLink.role, 'output')
      )
    )
    .orderBy(desc(userAsset.createdAt))
    .limit(1)) as LinkedOutput[];

  const linkedOutput = linkedOutputs[0];
  const fallbackUrl = resolveOutputMedia(record.output).resultUrl;
  return linkedOutput?.publicUrl ?? fallbackUrl ?? null;
};

async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return Response.json({ error: 'Missing taskId' }, { status: 400 });
  }

  const assetUrl = await getDownloadUrl({ taskId });

  if (!assetUrl) {
    return Response.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (!isOfficialBeatApiMediaUrl(assetUrl)) {
    return Response.json(
      { error: 'Only official BeatAPI media can be downloaded in this release' },
      { status: 403 }
    );
  }

  const upstream = await fetch(assetUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return Response.json(
      { error: 'Failed to fetch asset' },
      { status: 502 }
    );
  }

  const contentType =
    upstream.headers.get('content-type') ?? 'application/octet-stream';
  const extension =
    getExtensionFromValue(assetUrl) ??
    getExtensionFromContentType(contentType) ??
    'bin';
  const contentLength = upstream.headers.get('content-length');
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'content-disposition': `attachment; filename=${taskId}.${extension}`,
    'content-type': contentType,
  });

  if (contentLength) {
    headers.set('content-length', contentLength);
  }

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}

export const Route = createFileRoute('/api/assets/download')({
  server: {
    handlers: { GET },
  },
});
