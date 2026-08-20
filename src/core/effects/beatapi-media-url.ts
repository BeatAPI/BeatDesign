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
