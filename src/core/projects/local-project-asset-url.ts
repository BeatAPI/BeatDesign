const LOCAL_PROJECT_ASSET_PATH =
  /^\/api\/app\/projects\/([^/]+)\/assets\/([^/?#]+)(?:[/?#]|$)/;

export const parseLocalProjectAssetUrl = (url: string | null | undefined) => {
  if (!url) return null;
  let pathname = url;
  try {
    pathname = new URL(url, 'http://127.0.0.1').pathname;
  } catch {
    return null;
  }
  const match = LOCAL_PROJECT_ASSET_PATH.exec(pathname);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    assetId: decodeURIComponent(match[2]),
  };
};
