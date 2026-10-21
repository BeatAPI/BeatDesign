const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Host is checked independently of Origin: same-origin metadata cannot stop DNS rebinding. */
export function isTrustedWorkspaceHost(request: Request): boolean {
  try {
    const url = new URL(request.url);
    if (!['http:', 'https:'].includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname)) return false;
    const host = request.headers.get('host');
    // In-process Requests may omit Host; real HTTP requests have it. When present,
    // reject conflicting authorities as well as non-local authorities.
    return host === null || host.toLowerCase() === url.host.toLowerCase();
  } catch {
    return false;
  }
}
