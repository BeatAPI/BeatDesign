const DEFAULT_EFFECTS_POLL_INTERVAL_MS = 20_000;
const DEFAULT_EFFECTS_GENERATION_TIMEOUT_MS = 30 * 60 * 1000;
const procEnv =
  typeof process !== 'undefined' && process.env ? process.env : {};

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatDuration = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  if (minutes >= 1 && minutes * 60_000 === ms) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const seconds = Math.round(ms / 1000);
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
};

export const EFFECTS_POLL_INTERVAL_MS = readPositiveInt(
  procEnv.EFFECTS_POLL_INTERVAL_MS,
  DEFAULT_EFFECTS_POLL_INTERVAL_MS
);

export const EFFECTS_GENERATION_TIMEOUT_MS = readPositiveInt(
  procEnv.EFFECTS_GENERATION_TIMEOUT_MS,
  DEFAULT_EFFECTS_GENERATION_TIMEOUT_MS
);

export const EFFECTS_GENERATION_TIMEOUT_MESSAGE = `Task timed out after ${formatDuration(
  EFFECTS_GENERATION_TIMEOUT_MS
)}`;

export const isEffectsGenerationTimeoutError = (
  error: string | null | undefined
) => typeof error === 'string' && /^Task timed out after /i.test(error);
