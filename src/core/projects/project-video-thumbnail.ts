import { getCachedVideoThumbnail } from '@/core/media/video-thumbnail-cache';
import { getProjectAssetById } from '@/core/workspace-lib/assets/user-assets';
import { LOCAL_PROJECT_ASSET_BUCKET, LOCAL_PROJECT_ASSET_PROVIDER, resolveLocalProjectAssetPath } from './local-project-assets';

export async function getProjectVideoThumbnailResponse(request: Request, params: { projectId: string; assetId: string }) {
  // Recheck project membership even when an image is already cached on disk.
  const asset = await getProjectAssetById(params);
  if (!asset || asset.type !== 'video' || asset.bucket !== LOCAL_PROJECT_ASSET_BUCKET || asset.storageProvider !== LOCAL_PROJECT_ASSET_PROVIDER) {
    return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  try {
    const thumbnail = await getCachedVideoThumbnail({
      filePath: resolveLocalProjectAssetPath({ objectKey: asset.objectKey }),
      assetId: asset.id, durationMs: asset.durationMs,
    });
    const headers = new Headers({
      'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400',
      'etag': `"${thumbnail.key}"`, 'x-content-type-options': 'nosniff',
    });
    if (request.headers.get('if-none-match') === headers.get('etag')) return new Response(null, { status: 304, headers });
    headers.set('content-length', String(thumbnail.bytes.byteLength));
    return new Response(thumbnail.bytes as BodyInit, { headers });
  } catch {
    // Show the poster placeholder; never redirect to or return the original video.
    return new Response(null, { status: 503, headers: { 'cache-control': 'no-store', 'retry-after': '60' } });
  }
}
