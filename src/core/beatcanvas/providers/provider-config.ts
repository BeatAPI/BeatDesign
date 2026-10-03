export const BEATCANVAS_PROVIDER_IDS = ['beatapi', '16688'] as const;

export type BeatCanvasProviderId =
  (typeof BEATCANVAS_PROVIDER_IDS)[number];

export type BeatCanvasProviderPublicConfig = {
  id: BeatCanvasProviderId;
  label: string;
  isDefault: boolean;
  supports: readonly ('image' | 'video' | 'analysis')[];
  baseUrl: string;
  configPath: '/api/config/beatapi' | '/api/config/16688';
  apiKeyUrl: string;
};

export type BeatCanvasProviderServerConfig =
  BeatCanvasProviderPublicConfig & {
    baseUrl: string;
    apiKey: string;
  };

export const DEFAULT_BEATAPI_BASE_URL = 'https://api.beatapi.io';
export const DEFAULT_16688_BASE_URL = 'https://api.16688.org';

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
  value: string | null | undefined
): BeatCanvasProviderId =>
  value === 'beatapi' || value === '16688' ? value : 'beatapi';

export const getBeatCanvasProviderPublicConfig = (
  providerId: string | null | undefined
): BeatCanvasProviderPublicConfig => {
  const id = resolveBeatCanvasProviderId(providerId);
  return id === '16688'
    ? {
        id,
        label: '16688 AI',
        isDefault: true,
        supports: ['image'],
        baseUrl: DEFAULT_16688_BASE_URL,
        configPath: '/api/config/16688',
        apiKeyUrl: 'https://api.16688.org/token',
      }
    : {
        id,
        label: 'BeatAPI',
        isDefault: true,
        supports: ['image', 'video', 'analysis'],
        baseUrl: DEFAULT_BEATAPI_BASE_URL,
        configPath: '/api/config/beatapi',
        apiKeyUrl: 'https://beatapi.io/dashboard/apikeys',
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
    baseUrl: publicConfig.baseUrl,
    apiKey: apiKey || '',
  };
};
