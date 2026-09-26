export const normalizeMediaGatewayBaseUrl = (value: string) => {
  const candidate = new URL(value);
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(
    candidate.hostname
  );
  if (
    candidate.username ||
    candidate.password ||
    candidate.search ||
    candidate.hash ||
    (candidate.protocol !== 'https:' &&
      !(candidate.protocol === 'http:' && isLoopback))
  ) {
    throw new Error(
      'Media gateway must use HTTPS, or HTTP on the local computer.'
    );
  }
  return candidate.href.replace(/\/+$/, '');
};
