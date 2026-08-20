export const BEATCANVAS_PROVIDER_IDS = ['beatapi'] as const;

export type BeatCanvasProviderId =
  (typeof BEATCANVAS_PROVIDER_IDS)[number];

export type BeatCanvasProviderPublicConfig = {
  id: BeatCanvasProviderId;
  label: string;
  isDefault: boolean;
  supports: readonly ['image', 'video'];
};

export type BeatCanvasProviderServerConfig =
  BeatCanvasProviderPublicConfig & {
    baseUrl: string;
    apiKey: string;
  };

export const DEFAULT_BEATAPI_BASE_URL = 'https://api.beatapi.io';

export const isOfficialBeatApiBaseUrl = (
  baseUrl: string | null | undefined
): boolean => {
  try {
    const candidate = new URL(baseUrl || DEFAULT_BEATAPI_BASE_URL);
    const official = new URL(DEFAULT_BEATAPI_BASE_URL);
    const candidatePath = candidate.pathname.replace(/\/+$/, '') || '/';
    const officialPath = official.pathname.replace(/\/+$/, '') || '/';

    return (
      candidate.protocol === official.protocol &&
      candidate.host === official.host &&
      candidatePath === officialPath &&
      !candidate.username &&
      !candidate.password &&
      !candidate.search &&
      !candidate.hash
    );
  } catch {
    return false;
  }
};

export const resolveBeatCanvasProviderId = (
  _value: string | null | undefined
): BeatCanvasProviderId => 'beatapi';

export const getBeatCanvasProviderPublicConfig = (
  providerId: string | null | undefined
): BeatCanvasProviderPublicConfig => {
  const id = resolveBeatCanvasProviderId(providerId);

  return {
    id,
    label: 'BeatAPI',
    isDefault: true,
    supports: ['image', 'video'],
  };
};

export const getBeatCanvasProviderServerConfig = ({
  providerId,
  baseUrl: _baseUrl,
  apiKey,
}: {
  providerId?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
} = {}): BeatCanvasProviderServerConfig => {
  const publicConfig = getBeatCanvasProviderPublicConfig(providerId);

  return {
    ...publicConfig,
    baseUrl: DEFAULT_BEATAPI_BASE_URL,
    apiKey: apiKey || '',
  };
};
