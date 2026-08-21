export type WorkspaceRegistryType = 'ai-video' | 'ai-image';

type WorkspaceRegistryModelMode = 'quality' | 'fast' | 'lite';
type WorkspaceRegistryModelVariant = 'standard' | 'pro';
type WorkspaceRegistryDuration = `${number}s`;
type WorkspaceRegistryAspectRatio =
  | '16:9'
  | '21:9'
  | '4:3'
  | '5:4'
  | '9:16'
  | '9:21'
  | '3:4'
  | '1:1'
  | '1:2'
  | '2:1'
  | '1:3'
  | '3:1'
  | '2:3'
  | '3:2'
  | '4:5'
  | 'auto'
  | 'adaptive'
  | 'landscape'
  | 'portrait';
type WorkspaceRegistryQualityOption = 'standard' | 'high' | 'low' | 'medium';
type WorkspaceRegistryAudioSetting = 'auto' | 'origin';
type WorkspaceRegistryLanguage = 'zh' | 'en';
type WorkspaceRegistryOutputQuality =
  | '1k'
  | '2k'
  | '480p'
  | '720p'
  | '768p'
  | '1080p'
  | '4k'
  | 'std'
  | 'pro';
type WorkspaceRegistryReferenceType = 'image' | 'video';
export type WorkspaceRegistryBackgroundSource = 'input_image' | 'input_video';
export type WorkspaceRegistryCharacterOrientation = 'image' | 'video';

export type WorkspaceModelMode = WorkspaceRegistryModelMode;
export type WorkspaceModelVariant = WorkspaceRegistryModelVariant;
export type WorkspaceDuration = WorkspaceRegistryDuration;
export type WorkspaceAspectRatio = WorkspaceRegistryAspectRatio;
export type WorkspaceQualityOption = WorkspaceRegistryQualityOption;
export type WorkspaceAudioSetting = WorkspaceRegistryAudioSetting;
export type WorkspaceLanguage = WorkspaceRegistryLanguage;
export type WorkspaceOutputQuality = WorkspaceRegistryOutputQuality;

export type WorkspaceEffectRegistryAliasDefaults = {
  defaultMode?: WorkspaceRegistryModelMode;
  defaultVariant?: WorkspaceRegistryModelVariant;
};

export type WorkspaceEffectRegistryEntry = {
  id: string;
  name: string;
  effectId: number;
  workspaceType: WorkspaceRegistryType;
  uploadPath: string;
  imageBucketName: string;
  routeSlug: string | null;
  routeAliases?: string[];
  routeOrder?: number;
  defaultMode?: WorkspaceRegistryModelMode;
  modeOptions?: WorkspaceRegistryModelMode[];
  defaultVariant?: WorkspaceRegistryModelVariant;
  variantOptions?: WorkspaceRegistryModelVariant[];
  defaultDuration?: WorkspaceRegistryDuration;
  supportedDurations?: WorkspaceRegistryDuration[];
  defaultAspectRatio?: WorkspaceRegistryAspectRatio;
  supportedAspectRatios?: WorkspaceRegistryAspectRatio[];
  defaultOutputQuality?: WorkspaceRegistryOutputQuality;
  supportedOutputQualities?: WorkspaceRegistryOutputQuality[];
  defaultQuality?: WorkspaceRegistryQualityOption;
  qualityOptions?: WorkspaceRegistryQualityOption[];
  defaultAudioSetting?: WorkspaceRegistryAudioSetting;
  audioSettingOptions?: WorkspaceRegistryAudioSetting[];
  defaultLanguage?: WorkspaceRegistryLanguage;
  supportedLanguages?: WorkspaceRegistryLanguage[];
  defaultCharacterOrientation?: WorkspaceRegistryCharacterOrientation;
  characterOrientationOptions?: WorkspaceRegistryCharacterOrientation[];
  defaultBackgroundSource?: WorkspaceRegistryBackgroundSource;
  backgroundSourceOptions?: WorkspaceRegistryBackgroundSource[];
  requiresSourceVideoDuration?: boolean;
  providerModelVariantByVariant?: Partial<
    Record<WorkspaceRegistryModelVariant, string>
  >;
  referenceInputDefaultsByType?: Partial<
    Record<
      WorkspaceRegistryReferenceType,
      {
        backgroundSource?: WorkspaceRegistryBackgroundSource;
        characterOrientation?: WorkspaceRegistryCharacterOrientation;
      }
    >
  >;
  modelAliases?: string[];
  aliasDefaults?: Record<string, WorkspaceEffectRegistryAliasDefaults>;
};

const durationRange = (from: number, to: number): WorkspaceRegistryDuration[] =>
  Array.from(
    { length: to - from + 1 },
    (_, index) => `${from + index}s` as WorkspaceRegistryDuration
  );

const SEEDANCE_ASPECT_RATIOS = [
  'adaptive',
  '21:9',
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
] as const;

export const WORKSPACE_EFFECT_REGISTRY: readonly WorkspaceEffectRegistryEntry[] =
  [
    {
      id: 'nano-banana-pro',
      name: 'Nano Banana Pro',
      effectId: 6,
      workspaceType: 'ai-image',
      uploadPath: 'effects/nano-banana-pro',
      imageBucketName: 'image',
      routeSlug: 'nano-banana-pro',
      routeOrder: 10,
      defaultAspectRatio: '1:1',
      supportedAspectRatios: [
        '1:1',
        '2:3',
        '3:2',
        '3:4',
        '4:3',
        '4:5',
        '5:4',
        '9:16',
        '16:9',
        '21:9',
        'auto',
      ],
      defaultOutputQuality: '2k',
      supportedOutputQualities: ['1k', '2k', '4k'],
      modelAliases: ['nanobananapro'],
    },
    {
      id: 'nano-banana',
      name: 'Nano Banana',
      effectId: 5,
      workspaceType: 'ai-image',
      uploadPath: 'effects/nano-banana',
      imageBucketName: 'image',
      routeSlug: 'nano-banana',
      routeOrder: 20,
      defaultAspectRatio: '1:1',
      supportedAspectRatios: [
        '1:1',
        '9:16',
        '16:9',
        '3:4',
        '4:3',
        '3:2',
        '2:3',
        '5:4',
        '4:5',
        '21:9',
        'auto',
      ],
      modelAliases: ['nanobanana'],
    },
    {
      id: 'gpt-image-2',
      name: 'GPT Image 2',
      effectId: 12,
      workspaceType: 'ai-image',
      uploadPath: 'effects/gpt-image-2',
      imageBucketName: 'image',
      routeSlug: 'gpt-image-2',
      routeOrder: 30,
      defaultAspectRatio: 'auto',
      supportedAspectRatios: [
        'auto',
        '1:1',
        '3:2',
        '2:3',
        '4:3',
        '3:4',
        '5:4',
        '4:5',
        '16:9',
        '9:16',
        '2:1',
        '1:2',
        '3:1',
        '1:3',
        '21:9',
        '9:21',
      ],
      defaultOutputQuality: '1k',
      supportedOutputQualities: ['1k', '2k', '4k'],
    },
    {
      id: 'seedream-5-pro',
      name: 'Seedream 5 Pro',
      effectId: 16,
      workspaceType: 'ai-image',
      uploadPath: 'effects/seedream-5-pro',
      imageBucketName: 'image',
      routeSlug: 'seedream-5-pro',
      routeOrder: 40,
      defaultAspectRatio: '1:1',
      supportedAspectRatios: [
        'auto',
        '1:1',
        '4:3',
        '3:4',
        '16:9',
        '9:16',
        '3:2',
        '2:3',
        '21:9',
      ],
      defaultOutputQuality: '1k',
      supportedOutputQualities: ['1k', '2k'],
    },
    {
      id: 'seedance-2',
      name: 'Seedance 2',
      effectId: 9,
      workspaceType: 'ai-video',
      uploadPath: 'effects/seedance-2',
      imageBucketName: 'image',
      routeSlug: 'seedance-2',
      routeAliases: ['seedance-2-0', 'seedance2-0'],
      routeOrder: 10,
      defaultDuration: '5s',
      supportedDurations: durationRange(4, 15),
      defaultAspectRatio: 'adaptive',
      supportedAspectRatios: [...SEEDANCE_ASPECT_RATIOS],
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['480p', '720p', '1080p', '4k'],
      modelAliases: ['seedance20'],
    },
    {
      id: 'seedance-2-fast',
      name: 'Seedance 2 Fast',
      effectId: 21,
      workspaceType: 'ai-video',
      uploadPath: 'effects/seedance-2-fast',
      imageBucketName: 'image',
      routeSlug: 'seedance-2-fast',
      routeAliases: ['seedance-2.0-fast', 'seedance20-fast'],
      routeOrder: 12,
      defaultDuration: '5s',
      supportedDurations: durationRange(4, 15),
      defaultAspectRatio: 'adaptive',
      supportedAspectRatios: [...SEEDANCE_ASPECT_RATIOS],
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['480p', '720p'],
      modelAliases: ['seedance20fast'],
    },
    {
      id: 'seedance-2-mini',
      name: 'Seedance 2 Mini',
      effectId: 22,
      workspaceType: 'ai-video',
      uploadPath: 'effects/seedance-2-mini',
      imageBucketName: 'image',
      routeSlug: 'seedance-2-mini',
      routeAliases: ['seedance-2.0-mini', 'seedance20-mini'],
      routeOrder: 14,
      defaultDuration: '5s',
      supportedDurations: durationRange(4, 15),
      defaultAspectRatio: 'adaptive',
      supportedAspectRatios: [...SEEDANCE_ASPECT_RATIOS],
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['480p', '720p'],
      modelAliases: ['seedance20mini'],
    },
    {
      id: 'seedance-2.5',
      name: 'Seedance 2.5',
      effectId: 18,
      workspaceType: 'ai-video',
      uploadPath: 'effects/seedance-2-5',
      imageBucketName: 'image',
      routeSlug: 'seedance-2-5',
      routeOrder: 20,
      defaultDuration: '5s',
      supportedDurations: durationRange(4, 30),
      defaultAspectRatio: 'adaptive',
      supportedAspectRatios: [...SEEDANCE_ASPECT_RATIOS],
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['720p'],
    },
    {
      id: 'minimax-h3',
      name: 'MiniMax H3',
      effectId: 17,
      workspaceType: 'ai-video',
      uploadPath: 'effects/minimax-h3',
      imageBucketName: 'image',
      routeSlug: 'minimax-h3',
      routeOrder: 30,
      defaultDuration: '5s',
      supportedDurations: durationRange(4, 15),
      defaultAspectRatio: 'adaptive',
      supportedAspectRatios: [...SEEDANCE_ASPECT_RATIOS],
      defaultOutputQuality: '768p',
      supportedOutputQualities: ['768p', '2k'],
    },
    {
      id: 'veo-3.1',
      name: 'Veo 3.1',
      effectId: 1,
      workspaceType: 'ai-video',
      uploadPath: 'effects/veo-3-1',
      imageBucketName: 'image',
      routeSlug: 'veo-3-1',
      routeAliases: ['veo3-1'],
      routeOrder: 40,
      defaultAspectRatio: '16:9',
      supportedAspectRatios: ['16:9', '9:16', 'auto'],
      defaultDuration: '8s',
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['720p', '1080p', '4k'],
      defaultMode: 'quality',
      modeOptions: ['quality', 'fast', 'lite'],
      modelAliases: ['veo31', 'veo31-quality', 'veo31-fast', 'veo31-lite'],
      aliasDefaults: {
        'veo31-quality': { defaultMode: 'quality' },
        'veo31-fast': { defaultMode: 'fast' },
        'veo31-lite': { defaultMode: 'lite' },
      },
    },
    {
      id: 'kling-3',
      name: 'Kling 3',
      effectId: 10,
      workspaceType: 'ai-video',
      uploadPath: 'effects/kling-3',
      imageBucketName: 'image',
      routeSlug: 'kling-3',
      routeAliases: ['kling-3-0', 'kling3-0'],
      routeOrder: 50,
      defaultDuration: '5s',
      supportedDurations: durationRange(3, 15),
      defaultAspectRatio: '16:9',
      supportedAspectRatios: ['16:9', '9:16', '1:1'],
      defaultOutputQuality: 'pro',
      supportedOutputQualities: ['std', 'pro', '4k'],
      modelAliases: ['kling30'],
    },
    {
      id: 'kling-2.6-motion-control',
      name: 'Kling 2.6 Motion Control',
      effectId: 19,
      workspaceType: 'ai-video',
      uploadPath: 'effects/kling-2-6-motion-control',
      imageBucketName: 'image',
      routeSlug: 'kling-2-6-motion-control',
      routeAliases: ['kling-2.6-motion-control', 'kling26-motion-control'],
      routeOrder: 60,
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['720p', '1080p'],
      defaultCharacterOrientation: 'video',
      characterOrientationOptions: ['image', 'video'],
      requiresSourceVideoDuration: true,
      referenceInputDefaultsByType: {
        video: { characterOrientation: 'video' },
      },
      modelAliases: ['kling26motioncontrol'],
    },
    {
      id: 'kling-3-motion-control',
      name: 'Kling 3.0 Motion Control',
      effectId: 20,
      workspaceType: 'ai-video',
      uploadPath: 'effects/kling-3-motion-control',
      imageBucketName: 'image',
      routeSlug: 'kling-3-motion-control',
      routeAliases: ['kling-3.0-motion-control', 'kling30-motion-control'],
      routeOrder: 70,
      defaultOutputQuality: '720p',
      supportedOutputQualities: ['720p', '1080p'],
      defaultCharacterOrientation: 'video',
      characterOrientationOptions: ['image', 'video'],
      defaultBackgroundSource: 'input_video',
      backgroundSourceOptions: ['input_video', 'input_image'],
      requiresSourceVideoDuration: true,
      referenceInputDefaultsByType: {
        video: {
          characterOrientation: 'video',
          backgroundSource: 'input_video',
        },
      },
      modelAliases: ['kling3motioncontrol', 'kling30motioncontrol'],
    },
  ] as const;

const WORKSPACE_EFFECT_REGISTRY_BY_ID = new Map(
  WORKSPACE_EFFECT_REGISTRY.map((entry) => [entry.id, entry])
);

const WORKSPACE_EFFECT_REGISTRY_BY_ALIAS = new Map(
  WORKSPACE_EFFECT_REGISTRY.flatMap((entry) =>
    (entry.modelAliases ?? []).map((alias) => [alias, entry] as const)
  )
);

const WORKSPACE_EFFECT_REGISTRY_BY_EFFECT_ID = new Map(
  WORKSPACE_EFFECT_REGISTRY.map((entry) => [entry.effectId, entry])
);

export const getWorkspaceEffectRegistryEntry = (
  modelId: string
): WorkspaceEffectRegistryEntry | null =>
  WORKSPACE_EFFECT_REGISTRY_BY_ID.get(modelId) ??
  WORKSPACE_EFFECT_REGISTRY_BY_ALIAS.get(modelId) ??
  null;

export const getWorkspaceEffectRegistryEntryByEffectId = (
  effectId: number
): WorkspaceEffectRegistryEntry | null =>
  WORKSPACE_EFFECT_REGISTRY_BY_EFFECT_ID.get(effectId) ?? null;

export const resolveWorkspaceEffectProviderModelVariant = ({
  modelId,
  variant,
}: {
  modelId: string;
  variant?: WorkspaceRegistryModelVariant | null;
}): string => {
  const entry = getWorkspaceEffectRegistryEntry(modelId);
  if (!entry || !variant) {
    return modelId;
  }

  return entry.providerModelVariantByVariant?.[variant] ?? modelId;
};

export const getWorkspaceEffectReferenceInputDefaults = ({
  modelId,
  referenceType,
}: {
  modelId: string;
  referenceType?: WorkspaceRegistryReferenceType | null;
}) => {
  const entry = getWorkspaceEffectRegistryEntry(modelId);
  if (!entry || !referenceType) {
    return null;
  }

  return entry.referenceInputDefaultsByType?.[referenceType] ?? null;
};

export const getWorkspaceEffectRegistryEntriesByType = (
  workspaceType: WorkspaceRegistryType
): WorkspaceEffectRegistryEntry[] =>
  WORKSPACE_EFFECT_REGISTRY.filter(
    (entry) => entry.workspaceType === workspaceType
  );

export const getRoutableWorkspaceEffectRegistryEntriesByType = (
  workspaceType: WorkspaceRegistryType
): Array<WorkspaceEffectRegistryEntry & { routeSlug: string }> =>
  WORKSPACE_EFFECT_REGISTRY.filter(
    (entry): entry is WorkspaceEffectRegistryEntry & { routeSlug: string } =>
      entry.workspaceType === workspaceType &&
      typeof entry.routeSlug === 'string'
  ).sort((left, right) => (left.routeOrder ?? 0) - (right.routeOrder ?? 0));
