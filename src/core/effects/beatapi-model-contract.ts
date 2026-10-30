export type BeatApiVideoReferenceContract = {
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
  allowsAudioOnly: boolean;
};

export const BEATAPI_IMAGE_REFERENCE_LIMITS = {
  'nano-banana': 3,
  'nano-banana-2': 14,
  'nano-banana-2.1': 14,
  'nano-banana-2-lite': 14,
  'nano-banana-pro': 14,
  'gpt-image-2': 16,
  'gpt-image-2.5-flare': 16,
  'gpt-image-2.5-sunburst': 16,
  'seedream-5-pro': 10,
  'seedream-5-lite': 6,
  'qwen-image-2.1': 10,
  'grok-imagine-image-2.0': 5,
} as const;

export const BEATAPI_VIDEO_REFERENCE_CONTRACTS = {
  'minimax-h3': {
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    allowsAudioOnly: false,
  },
  'minimax-h3-fast': { maxReferenceImages: 9, maxReferenceVideos: 3, maxReferenceAudios: 3, allowsAudioOnly: false },
  'minimax-h3-normal': { maxReferenceImages: 4, maxReferenceVideos: 1, maxReferenceAudios: 0, allowsAudioOnly: false },
  'kling-v4': { maxReferenceImages: 10, maxReferenceVideos: 5, maxReferenceAudios: 3, allowsAudioOnly: false },
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
  'wan-3.0': {
    maxReferenceImages: 10,
    maxReferenceVideos: 5,
    maxReferenceAudios: 5,
    allowsAudioOnly: true,
  },
  'wan-3.0-prime': {
    maxReferenceImages: 10,
    maxReferenceVideos: 5,
    maxReferenceAudios: 5,
    allowsAudioOnly: true,
  },
  'happyhorse-1.0': {
    maxReferenceImages: 9,
    maxReferenceVideos: 0,
    maxReferenceAudios: 0,
    allowsAudioOnly: false,
  },
  'happyhorse-1.1': {
    maxReferenceImages: 9,
    maxReferenceVideos: 0,
    maxReferenceAudios: 0,
    allowsAudioOnly: false,
  },
  'minimax-h3-max': {
    maxReferenceImages: 2,
    maxReferenceVideos: 0,
    maxReferenceAudios: 0,
    allowsAudioOnly: false,
  },
  'minimax-h3-max-turbo': {
    maxReferenceImages: 2,
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
