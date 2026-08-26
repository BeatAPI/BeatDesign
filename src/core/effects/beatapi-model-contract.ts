export type BeatApiVideoReferenceContract = {
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
  allowsAudioOnly: boolean;
};

export const BEATAPI_IMAGE_REFERENCE_LIMITS = {
  'nano-banana': 10,
  'nano-banana-pro': 8,
  'gpt-image-2': 16,
  'seedream-5-pro': 10,
  'grok-imagine-image-2.0': 5,
} as const;

export const BEATAPI_VIDEO_REFERENCE_CONTRACTS = {
  'minimax-h3': {
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    allowsAudioOnly: false,
  },
  'seedance-2': {
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    allowsAudioOnly: false,
  },
  'seedance-2-fast': {
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    allowsAudioOnly: false,
  },
  'seedance-2-mini': {
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    allowsAudioOnly: false,
  },
  'seedance-2.5': {
    maxReferenceImages: 30,
    maxReferenceVideos: 10,
    maxReferenceAudios: 10,
    allowsAudioOnly: true,
  },
  'veo-3.1': {
    maxReferenceImages: 3,
    maxReferenceVideos: 0,
    maxReferenceAudios: 0,
    allowsAudioOnly: false,
  },
  'grok-imagine-video-1.5': {
    maxReferenceImages: 7,
    maxReferenceVideos: 0,
    maxReferenceAudios: 0,
    allowsAudioOnly: false,
  },
} as const satisfies Record<string, BeatApiVideoReferenceContract>;

export const getBeatApiImageReferenceLimit = (modelId: string) =>
  BEATAPI_IMAGE_REFERENCE_LIMITS[
    modelId as keyof typeof BEATAPI_IMAGE_REFERENCE_LIMITS
  ] ?? 0;

export const getBeatApiVideoReferenceContract = (
  modelId: string
): BeatApiVideoReferenceContract | null =>
  BEATAPI_VIDEO_REFERENCE_CONTRACTS[
    modelId as keyof typeof BEATAPI_VIDEO_REFERENCE_CONTRACTS
  ] ?? null;
