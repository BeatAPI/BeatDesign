const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal'];

const isPrivateIpv4 = (hostname: string) => {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

const isPrivateIpv6 = (hostname: string) => {
  const value = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value)
  );
};

export type StorageEndpointPolicyResult =
  | { ok: true; endpoint: string }
  | { ok: false; message: string };

export function validateStorageEndpoint(
  value: string,
  { allowPrivate = false }: { allowPrivate?: boolean } = {}
): StorageEndpointPolicyResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: 'Custom storage endpoint is not a valid URL' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, message: 'Custom storage endpoint must use HTTPS' };
  }
  if (url.username || url.password || url.search || url.hash) {
    return {
      ok: false,
      message: 'Custom storage endpoint cannot include credentials, query, or fragment',
    };
  }

  const hostname = url.hostname.toLowerCase();
  const isPrivate =
    hostname === 'localhost' ||
    PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname);
  if (isPrivate && !allowPrivate) {
    return {
      ok: false,
      message:
        'Private storage endpoints are not supported by the local workspace',
    };
  }

  return { ok: true, endpoint: url.toString().replace(/\/$/, '') };
}
