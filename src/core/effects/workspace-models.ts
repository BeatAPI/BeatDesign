import { buildCreateProjectPath } from '@/core/projects/project-entry';
import {
  WORKSPACE_EFFECT_REGISTRY,
  type WorkspaceAspectRatio,
  type WorkspaceAudioSetting,
  type WorkspaceRegistryBackgroundSource,
  type WorkspaceRegistryCharacterOrientation,
  type WorkspaceDuration,
  type WorkspaceLanguage,
  type WorkspaceModelMode,
  type WorkspaceModelVariant,
  type WorkspaceOutputQuality,
  type WorkspaceQualityOption,
  type WorkspaceRegistryType,
  getWorkspaceEffectRegistryEntriesByType,
  getWorkspaceEffectRegistryEntryByEffectId,
} from './effect-registry';
import {
  type WorkspaceMediaSchema,
  getWorkspaceMediaSchema,
} from './workspace-media';

export type WorkspaceType = WorkspaceRegistryType;
export type WorkspaceBackgroundSource = WorkspaceRegistryBackgroundSource;
export type WorkspaceCharacterOrientation = WorkspaceRegistryCharacterOrientation;
export type {
  WorkspaceAspectRatio,
  WorkspaceAudioSetting,
  WorkspaceDuration,
  WorkspaceLanguage,
  WorkspaceModelMode,
  WorkspaceModelVariant,
  WorkspaceOutputQuality,
  WorkspaceQualityOption,
} from './effect-registry';

export type WorkspaceModelOption = {
  id: string;
  name: string;
  effectId: number;
  mediaSchema?: WorkspaceMediaSchema;
  mode?: WorkspaceModelMode;
  defaultMode?: WorkspaceModelMode;
  modeOptions?: WorkspaceModelMode[];
  defaultVariant?: WorkspaceModelVariant;
  variantOptions?: WorkspaceModelVariant[];
  uploadPath: string;
  imageBucketName: string;
  defaultDuration?: WorkspaceDuration;
  supportedDurations?: WorkspaceDuration[];
  defaultAspectRatio?: WorkspaceAspectRatio;
  supportedAspectRatios?: WorkspaceAspectRatio[];
  referenceOnlyAspectRatios?: WorkspaceAspectRatio[];
  defaultOutputQuality?: WorkspaceOutputQuality;
  supportedOutputQualities?: WorkspaceOutputQuality[];
  defaultQuality?: WorkspaceQualityOption;
  qualityOptions?: WorkspaceQualityOption[];
  defaultAudioSetting?: WorkspaceAudioSetting;
  audioSettingOptions?: WorkspaceAudioSetting[];
  defaultLanguage?: WorkspaceLanguage;
  supportedLanguages?: WorkspaceLanguage[];
  defaultCharacterOrientation?: WorkspaceCharacterOrientation;
  characterOrientationOptions?: WorkspaceCharacterOrientation[];
  defaultBackgroundSource?: WorkspaceBackgroundSource;
  backgroundSourceOptions?: WorkspaceBackgroundSource[];
  available?: boolean;
  supportsFramePair?: boolean;
  supportsSourceVideo?: boolean;
  supportsReferenceAudio?: boolean;
  maxReferenceImages?: number;
  maxSourceVideos?: number;
  maxReferenceAudios?: number;
};

const withMediaSchema = (
  workspaceType: WorkspaceType,
  modelId: string
): WorkspaceMediaSchema => {
  const mediaSchema = getWorkspaceMediaSchema(modelId);
  if (!mediaSchema) {
    throw new Error(
      `Missing workspace media schema for ${workspaceType}:${modelId}`
    );
  }

  return mediaSchema;
};

const toWorkspaceModelOption = (
  workspaceType: WorkspaceType,
  entry: (typeof WORKSPACE_EFFECT_REGISTRY)[number]
): WorkspaceModelOption => {
  const mediaSchema = withMediaSchema(workspaceType, entry.id);

  return {
    id: entry.id,
    name: entry.name,
    effectId: entry.effectId,
    mediaSchema,
    uploadPath: entry.uploadPath,
    imageBucketName: entry.imageBucketName,
    defaultMode: entry.defaultMode,
    modeOptions: entry.modeOptions ? [...entry.modeOptions] : undefined,
    defaultVariant: entry.defaultVariant,
    variantOptions: entry.variantOptions
      ? [...entry.variantOptions]
      : undefined,
    defaultDuration: entry.defaultDuration,
    supportedDurations: entry.supportedDurations
      ? [...entry.supportedDurations]
      : undefined,
    defaultAspectRatio: entry.defaultAspectRatio,
    supportedAspectRatios: entry.supportedAspectRatios
      ? [...entry.supportedAspectRatios]
      : undefined,
    referenceOnlyAspectRatios: entry.referenceOnlyAspectRatios
      ? [...entry.referenceOnlyAspectRatios]
      : undefined,
    defaultOutputQuality: entry.defaultOutputQuality,
    supportedOutputQualities: entry.supportedOutputQualities
      ? [...entry.supportedOutputQualities]
      : undefined,
    defaultQuality: entry.defaultQuality,
    qualityOptions: entry.qualityOptions
      ? [...entry.qualityOptions]
      : undefined,
    defaultAudioSetting: entry.defaultAudioSetting,
    audioSettingOptions: entry.audioSettingOptions
      ? [...entry.audioSettingOptions]
      : undefined,
    defaultLanguage: entry.defaultLanguage,
    supportedLanguages: entry.supportedLanguages
      ? [...entry.supportedLanguages]
      : undefined,
    defaultCharacterOrientation: entry.defaultCharacterOrientation,
    characterOrientationOptions: entry.characterOrientationOptions
      ? [...entry.characterOrientationOptions]
      : undefined,
    defaultBackgroundSource: entry.defaultBackgroundSource,
    backgroundSourceOptions: entry.backgroundSourceOptions
      ? [...entry.backgroundSourceOptions]
      : undefined,
    supportsFramePair: mediaSchema.image.slots.some(
      (slot) => slot.kind === 'last-frame'
    ),
    supportsSourceVideo: mediaSchema.video.max > 0,
    supportsReferenceAudio: mediaSchema.audio.max > 0,
    maxReferenceImages: mediaSchema.image.max,
    maxSourceVideos: mediaSchema.video.max,
    maxReferenceAudios: mediaSchema.audio.max,
  };
};

const VIDEO_MODELS: WorkspaceModelOption[] =
  getWorkspaceEffectRegistryEntriesByType('ai-video').map((entry) =>
    toWorkspaceModelOption('ai-video', entry)
  );

const IMAGE_MODELS: WorkspaceModelOption[] =
  getWorkspaceEffectRegistryEntriesByType('ai-image').map((entry) =>
    toWorkspaceModelOption('ai-image', entry)
  );

const WORKSPACE_LAUNCH_TARGET: Record<WorkspaceType, string> = {
  'ai-video': 'video',
  'ai-image': 'image',
};

const WORKSPACE_MODEL_ALIASES = Object.fromEntries(
  WORKSPACE_EFFECT_REGISTRY.flatMap((entry) =>
    (entry.modelAliases ?? []).map((alias) => [alias, entry.id] as const)
  )
);

const WORKSPACE_MODEL_DEFAULTS_BY_ALIAS = Object.fromEntries(
  WORKSPACE_EFFECT_REGISTRY.flatMap((entry) =>
    Object.entries(entry.aliasDefaults ?? {}).map(([alias, defaults]) => [
      alias,
      defaults,
    ])
  )
) as Record<
  string,
  Partial<Pick<WorkspaceModelOption, 'defaultMode' | 'defaultVariant'>>
>;

const DEFAULT_WORKSPACE_MODEL_ID_BY_TYPE: Partial<
  Record<WorkspaceType, string>
> = {
  'ai-image': 'nano-banana-pro',
  'ai-video': 'seedance-2',
};

export const getWorkspaceModelsByType = (
  workspaceType: WorkspaceType
): WorkspaceModelOption[] => {
  return workspaceType === 'ai-image' ? IMAGE_MODELS : VIDEO_MODELS;
};

export const getWorkspaceAspectRatioOptions = ({
  model,
  hasImageReferences,
}: {
  model: WorkspaceModelOption | null;
  hasImageReferences: boolean;
}): WorkspaceAspectRatio[] => [
  ...(model?.supportedAspectRatios ?? []),
  ...(hasImageReferences ? (model?.referenceOnlyAspectRatios ?? []) : []),
];

export const getCanonicalWorkspaceModelId = (modelId: string): string =>
  WORKSPACE_MODEL_ALIASES[modelId] ?? modelId;

export const findWorkspaceModelOption = <TModel extends { id: string }>(
  models: TModel[],
  modelId: string | null | undefined
): TModel | null => {
  if (!modelId) {
    return null;
  }

  const canonicalModelId = getCanonicalWorkspaceModelId(modelId);
  return (
    models.find(
      (model) => model.id === modelId || model.id === canonicalModelId
    ) ?? null
  );
};

export const getWorkspaceModelDefaultsForAlias = (modelId?: string | null) =>
  (modelId ? WORKSPACE_MODEL_DEFAULTS_BY_ALIAS[modelId] : undefined) ?? {};

export const getDefaultSelectableWorkspaceModel = (
  workspaceType: WorkspaceType
): WorkspaceModelOption | null =>
  getWorkspaceModelsByType(workspaceType).find(
    (model) =>
      model.id === DEFAULT_WORKSPACE_MODEL_ID_BY_TYPE[workspaceType] &&
      model.available !== false
  ) ??
  getWorkspaceModelsByType(workspaceType).find(
    (model) => model.available !== false
  ) ??
  null;

export const mergeWorkspaceModelOptions = <
  TPrimary extends { id: string },
  TFallback extends { id: string },
>(
  primaryModels: TPrimary[],
  fallbackModels: TFallback[]
): Array<TPrimary & TFallback> => {
  if (primaryModels.length === 0) {
    return fallbackModels as Array<TPrimary & TFallback>;
  }

  const primaryById = new Map<string, TPrimary>();
  for (const model of primaryModels) {
    if (!primaryById.has(model.id)) {
      primaryById.set(model.id, model);
    }
  }

  const mergedFallbackModels = fallbackModels.map((model) => {
    const primaryModel = primaryById.get(model.id);
    return primaryModel
      ? ({ ...model, ...primaryModel } as TPrimary & TFallback)
      : (model as TPrimary & TFallback);
  });

  const fallbackIds = new Set(fallbackModels.map((model) => model.id));
  const primaryOnlyModels = primaryModels
    .filter((model, index) => {
      if (fallbackIds.has(model.id)) {
        return false;
      }
      return primaryModels.findIndex((item) => item.id === model.id) === index;
    })
    .map((model) => model as TPrimary & TFallback);

  return [...mergedFallbackModels, ...primaryOnlyModels];
};

export const getDefaultWorkspaceType = (
  effectId?: number | null
): WorkspaceType =>
  effectId
    ? (getWorkspaceEffectRegistryEntryByEffectId(effectId)?.workspaceType ??
      'ai-video')
    : 'ai-video';

export const getHottestWorkspaceHref = (
  workspaceType: WorkspaceType
): string | null =>
  buildCreateProjectPath({
    target: WORKSPACE_LAUNCH_TARGET[workspaceType],
  });
