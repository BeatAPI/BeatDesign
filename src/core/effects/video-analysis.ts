export const VIDEO_ANALYSIS_EFFECT_ID = 1001;
export const VIDEO_ANALYSIS_MODEL_ID = 'video-analysis';
export const VIDEO_ANALYSIS_PROMPT_MAX_CHARS = 12_000;
export const VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS = 2048;
export const VIDEO_ANALYSIS_MIN_OUTPUT_TOKENS = 256;
export const VIDEO_ANALYSIS_MAX_OUTPUT_TOKENS = 8192;

export type VideoAnalysisDepth = 'standard' | 'deep';

export const isVideoAnalysisEffectId = (effectId: number) =>
  effectId === VIDEO_ANALYSIS_EFFECT_ID;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

export const resolveVideoAnalysisText = (output: unknown): string | null => {
  const root = asRecord(output);
  const nested = asRecord(root?.output);
  for (const value of [root?.analysis_text, root?.text, nested?.text]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};
