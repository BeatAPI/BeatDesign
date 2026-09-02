import { getCanonicalWorkspaceModelId } from '@/core/effects/workspace-models';

const MODEL_ICON_PATHS = {
  bytedance: '/model-icons/bytedance-color.svg',
  google: '/model-icons/google-color.svg',
  grok: '/model-icons/grok.svg',
  kling: '/model-icons/kling-color.svg',
  minimax: '/model-icons/minimax-color.svg',
  nanobanana: '/model-icons/nanobanana-color.svg',
  openai: '/model-icons/openai.svg',
} as const;

const MODEL_ICON_PATH_BY_MODEL_ID: Record<string, string> = {
  'gpt-image-2': MODEL_ICON_PATHS.openai,
  'grok-imagine-image-2.0': MODEL_ICON_PATHS.grok,
  'grok-imagine-video-1.5': MODEL_ICON_PATHS.grok,
  'kling-3': MODEL_ICON_PATHS.kling,
  'kling-2.6-motion-control': MODEL_ICON_PATHS.kling,
  'kling-3-motion-control': MODEL_ICON_PATHS.kling,
  'minimax-h3': MODEL_ICON_PATHS.minimax,
  'nano-banana': MODEL_ICON_PATHS.nanobanana,
  'nano-banana-2': MODEL_ICON_PATHS.nanobanana,
  'nano-banana-2-lite': MODEL_ICON_PATHS.nanobanana,
  'nano-banana-pro': MODEL_ICON_PATHS.nanobanana,
  'seedance-2': MODEL_ICON_PATHS.bytedance,
  'seedance-2-fast': MODEL_ICON_PATHS.bytedance,
  'seedance-2-mini': MODEL_ICON_PATHS.bytedance,
  'seedance-2.5': MODEL_ICON_PATHS.bytedance,
  'seedream-5-pro': MODEL_ICON_PATHS.bytedance,
  'veo-3.1': MODEL_ICON_PATHS.google,
  'video-analysis-standard': MODEL_ICON_PATHS.google,
  'video-analysis-pro': MODEL_ICON_PATHS.google,
};

export const getModelIconPathByModelId = (modelId: string): string | null => {
  const canonicalModelId = getCanonicalWorkspaceModelId(modelId);

  return (
    MODEL_ICON_PATH_BY_MODEL_ID[modelId] ??
    MODEL_ICON_PATH_BY_MODEL_ID[canonicalModelId] ??
    null
  );
};
