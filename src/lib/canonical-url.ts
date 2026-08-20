const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

export function getWwwRedirectLocation(requestUrl: string) {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.startsWith('www.')) return null;

  const canonicalHostname = hostname.slice(4);
  if (!canonicalHostname || isLocalHostname(canonicalHostname)) return null;

  url.protocol = 'https:';
  url.hostname = canonicalHostname;
  url.port = '';

  return url.toString();
}
