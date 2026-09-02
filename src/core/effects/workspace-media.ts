import { getWorkspaceEffectRegistryEntry } from './effect-registry';
import {
  getBeatApiImageReferenceLimit,
  getBeatApiVideoReferenceContract,
} from './beatapi-model-contract';

export type WorkspaceMediaCategory = 'image' | 'video' | 'audio';

export type WorkspaceMediaSlotKind =
  | 'reference-image'
  | 'first-frame'
  | 'last-frame'
  | 'reference-video'
  | 'motion'
  | 'source-video'
  | 'first-clip'
  | 'reference-audio'
  | 'driving-audio';

export type WorkspaceMediaSlot = {
  kind: WorkspaceMediaSlotKind;
};

export type WorkspaceMediaSection = {
  max: number;
  slots: WorkspaceMediaSlot[];
};

export type WorkspaceMediaSchema = {
  image: WorkspaceMediaSection;
  video: WorkspaceMediaSection;
  audio: WorkspaceMediaSection;
};

export type WorkspaceMediaSlotUrls = Array<string | null>;

const MAX_REFERENCE_IMAGE_SLOTS = 30;
const MAX_REFERENCE_VIDEO_SLOTS = 10;
const MAX_REFERENCE_AUDIO_SLOTS = 10;

const createSection = (
  max: number,
  slots: WorkspaceMediaSlot[]
): WorkspaceMediaSection => ({
  max,
  slots,
});

const repeatSlots = (
  kind: WorkspaceMediaSlotKind,
  count: number
): WorkspaceMediaSlot[] => Array.from({ length: count }, () => ({ kind }));

const createGenericSection = (
  kind: 'reference-image' | 'reference-video' | 'reference-audio',
  count: number
): WorkspaceMediaSection => {
  const max =
    kind === 'reference-image'
      ? Math.min(count, MAX_REFERENCE_IMAGE_SLOTS)
      : kind === 'reference-video'
        ? Math.min(count, MAX_REFERENCE_VIDEO_SLOTS)
        : Math.min(count, MAX_REFERENCE_AUDIO_SLOTS);

  return createSection(max, repeatSlots(kind, max));
};

const createVideoContractSection = (
  modelId: string,
  kind: 'reference-image' | 'reference-video' | 'reference-audio'
) => {
  const contract = getBeatApiVideoReferenceContract(modelId);
  if (!contract) {
    throw new Error(`Missing BeatAPI media contract for ${modelId}`);
  }
  const count =
    kind === 'reference-image'
      ? contract.maxReferenceImages
      : kind === 'reference-video'
        ? contract.maxReferenceVideos
        : contract.maxReferenceAudios;
  return createGenericSection(kind, count);
};

const emptySection = createSection(0, []);

const firstLastFrameSection = createSection(2, [
  { kind: 'first-frame' },
  { kind: 'last-frame' },
]);

export const WORKSPACE_MEDIA_SCHEMAS = {
  'nano-banana': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('nano-banana')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'nano-banana-2': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('nano-banana-2')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'nano-banana-2-lite': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('nano-banana-2-lite')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'nano-banana-pro': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('nano-banana-pro')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'gpt-image-2': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('gpt-image-2')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'seedream-5-pro': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('seedream-5-pro')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'grok-imagine-image-2.0': {
    image: createGenericSection(
      'reference-image',
      getBeatApiImageReferenceLimit('grok-imagine-image-2.0')
    ),
    video: emptySection,
    audio: emptySection,
  },
  'seedance-2': {
    image: createVideoContractSection('seedance-2', 'reference-image'),
    video: createVideoContractSection('seedance-2', 'reference-video'),
    audio: createVideoContractSection('seedance-2', 'reference-audio'),
  },
  'seedance-2-fast': {
    image: createVideoContractSection('seedance-2-fast', 'reference-image'),
    video: createVideoContractSection('seedance-2-fast', 'reference-video'),
    audio: createVideoContractSection('seedance-2-fast', 'reference-audio'),
  },
  'seedance-2-mini': {
    image: createVideoContractSection('seedance-2-mini', 'reference-image'),
    video: createVideoContractSection('seedance-2-mini', 'reference-video'),
    audio: createVideoContractSection('seedance-2-mini', 'reference-audio'),
  },
  'seedance-2.5': {
    image: createVideoContractSection('seedance-2.5', 'reference-image'),
    video: createVideoContractSection('seedance-2.5', 'reference-video'),
    audio: createVideoContractSection('seedance-2.5', 'reference-audio'),
  },
  'minimax-h3': {
    image: createVideoContractSection('minimax-h3', 'reference-image'),
    video: createVideoContractSection('minimax-h3', 'reference-video'),
    audio: createVideoContractSection('minimax-h3', 'reference-audio'),
  },
  'veo-3.1': {
    image: createVideoContractSection('veo-3.1', 'reference-image'),
    video: emptySection,
    audio: emptySection,
  },
  'grok-imagine-video-1.5': {
    image: createVideoContractSection(
      'grok-imagine-video-1.5',
      'reference-image'
    ),
    video: emptySection,
    audio: emptySection,
  },
  'kling-3': {
    image: firstLastFrameSection,
    video: emptySection,
    audio: emptySection,
  },
  'kling-2.6-motion-control': {
    image: createGenericSection('reference-image', 1),
    video: createGenericSection('reference-video', 1),
    audio: emptySection,
  },
  'kling-3-motion-control': {
    image: createGenericSection('reference-image', 1),
    video: createGenericSection('reference-video', 1),
    audio: emptySection,
  },
} as const satisfies Record<string, WorkspaceMediaSchema>;

export const isAppendMediaSection = (section: WorkspaceMediaSection) =>
  section.slots.length > 0 &&
  section.slots.every(
    (slot) =>
      slot.kind === 'reference-image' ||
      slot.kind === 'reference-video' ||
      slot.kind === 'reference-audio'
  );

export const appendItemsToAvailableSlots = <T>({
  current,
  incoming,
  limit,
}: {
  current: Array<T | null>;
  incoming: T[];
  limit: number;
}):
  | { ok: true; next: Array<T | null> }
  | { ok: false; next: Array<T | null>; availableSlots: number } => {
  const next = current.slice(0, limit);
  const availableSlots = Array.from({ length: limit }).filter(
    (_, index) => (next[index] ?? null) === null
  ).length;

  if (incoming.length === 0) {
    return { ok: true, next };
  }

  if (limit <= 0 || incoming.length > availableSlots) {
    return {
      ok: false,
      next,
      availableSlots,
    };
  }

  const openIndexes = Array.from({ length: limit }).flatMap((_, index) =>
    (next[index] ?? null) === null ? [index] : []
  );

  for (const [offset, item] of incoming.entries()) {
    const openIndex = openIndexes[offset];
    if (openIndex === undefined) {
      break;
    }
    next[openIndex] = item;
  }

  return { ok: true, next };
};

export const getWorkspaceMediaSchema = (
  modelId: string
): WorkspaceMediaSchema | null => {
  const canonicalModelId =
    getWorkspaceEffectRegistryEntry(modelId)?.id ?? modelId;
  if (
    !Object.prototype.hasOwnProperty.call(
      WORKSPACE_MEDIA_SCHEMAS,
      canonicalModelId
    )
  ) {
    return null;
  }

  return WORKSPACE_MEDIA_SCHEMAS[
    canonicalModelId as keyof typeof WORKSPACE_MEDIA_SCHEMAS
  ];
};

const flattenUrls = (
  slots: WorkspaceMediaSlot[],
  values: WorkspaceMediaSlotUrls
): string[] =>
  slots.flatMap((_, index) => {
    const value = values[index];
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  });

export const buildWorkspaceMediaInput = ({
  mediaSchema,
  imageSlotUrls,
  videoSlotUrls,
  audioSlotUrls,
}: {
  modelId: string;
  mediaSchema: WorkspaceMediaSchema;
  imageSlotUrls: WorkspaceMediaSlotUrls;
  videoSlotUrls: WorkspaceMediaSlotUrls;
  audioSlotUrls: WorkspaceMediaSlotUrls;
}) => {
  return {
    imageUrls: flattenUrls(mediaSchema.image.slots, imageSlotUrls),
    videoUrls: flattenUrls(mediaSchema.video.slots, videoSlotUrls),
    audioUrls: flattenUrls(mediaSchema.audio.slots, audioSlotUrls),
  };
};
