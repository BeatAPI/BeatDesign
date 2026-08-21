export const OFFICIAL_BEATAPI_MEDIA_HOST = 'media.beatapi.io';

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
