const PROJECT_ASSET_MEDIA_PATH =
  /^\/api\/app\/projects\/[^/]+\/assets\/[^/]+\/?$/;

const MEDIA_FETCH_DESTINATIONS = new Set(['audio', 'image', 'video']);

export function shouldNormalizeProjectAssetMediaRequest({
  method,
  url,
  destination,
}: {
  method: string | undefined;
  url: string | undefined;
  destination: string | undefined;
}) {
  if ((method !== 'GET' && method !== 'HEAD') || !url || !destination) {
    return false;
  }
  if (!MEDIA_FETCH_DESTINATIONS.has(destination.toLowerCase())) return false;
  return PROJECT_ASSET_MEDIA_PATH.test(new URL(url, 'http://localhost').pathname);
}

/**
 * TanStack Start treats browser media destinations as static asset requests
 * before file-route handlers run. Project assets are dynamic API resources, so
 * normalize only this route back to an ordinary fetch destination.
 */
export function normalizeProjectAssetMediaRequest(request: Request) {
  if (
    !shouldNormalizeProjectAssetMediaRequest({
      method: request.method,
      url: request.url,
      destination: request.headers.get('sec-fetch-dest') ?? undefined,
    })
  ) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.delete('sec-fetch-dest');
  return new Request(request.url, {
    method: request.method,
    headers,
    signal: request.signal,
  });
}
