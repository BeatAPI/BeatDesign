export const normalizeMediaGatewayBaseUrl = (
  value: string,
  { allowedHttpHosts = [] }: { allowedHttpHosts?: string[] } = {}
) => {
  const candidate = new URL(value);
  const hostname = candidate.hostname.toLowerCase();
  const isAllowedHttpHost = [
    '127.0.0.1',
    'localhost',
    '::1',
    ...allowedHttpHosts.map((host) => host.trim().toLowerCase()),
  ].includes(hostname);
  if (
    candidate.username ||
    candidate.password ||
    candidate.search ||
    candidate.hash ||
    (candidate.protocol !== 'https:' &&
      !(candidate.protocol === 'http:' && isAllowedHttpHost))
  ) {
    throw new Error(
      'Media gateway must use HTTPS, or an explicitly allowed private HTTP host.'
    );
  }
  return candidate.href.replace(/\/+$/, '');
};
