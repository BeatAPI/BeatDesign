export const OFFICIAL_BEATAPI_MEDIA_HOST = 'media.beatapi.io';

const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal'];

const isPrivateIpv4 = (hostname: string) => {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const isPrivateIpv6 = (hostname: string) => {
  const value = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('::ffff:') ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value)
  );
};

/**
 * Accept provider-returned public media URLs without coupling integrations to
 * a BeatAPI-owned host or path. Literal local/private hosts remain blocked.
 */
export const isPublicHttpMediaUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    return !(
      hostname === 'localhost' ||
      PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
      isPrivateIpv4(hostname) ||
      isPrivateIpv6(hostname)
    );
  } catch {
    return false;
  }
};

export const isOfficialBeatApiMediaUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === OFFICIAL_BEATAPI_MEDIA_HOST &&
      url.port === '' &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export const isOfficialBeatApiInputUrl = (value: string) => {
  if (!isOfficialBeatApiMediaUrl(value)) return false;
  try {
    return new URL(value).pathname.startsWith('/inputs/');
  } catch {
    return false;
  }
};
