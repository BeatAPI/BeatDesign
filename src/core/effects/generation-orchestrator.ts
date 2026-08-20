import {
  type GenerationInternalStatus,
  getPublicGenerationStatus,
} from './generation-lifecycle';
import { EFFECTS_GENERATION_TIMEOUT_MESSAGE } from './runtime-config';

type ProviderGenerationStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

type RecordObject = Record<string, unknown>;

const asObject = (value: unknown): RecordObject =>
  value && typeof value === 'object' ? (value as RecordObject) : {};

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

export const resolveProviderTaskId = (output: unknown) => {
  if (!output || typeof output !== 'object') return null;
  const taskId = (output as RecordObject).taskId;
  return typeof taskId === 'string' && taskId ? taskId : null;
};

export const withBaseResultUrl = (output: RecordObject) => {
  const existingBase = readString(output.base_result_url);
  if (existingBase) return output;
  const resultUrl = readString(output.result_url);
  if (!resultUrl) return output;
  return { ...output, base_result_url: resultUrl };
};

export const withFallbackFromBase = (output: RecordObject) => {
  const baseResultUrl = readString(output.base_result_url);
  if (!baseResultUrl) return output;
  return { ...output, result_url: baseResultUrl, quality_finalized: true };
};

export const normalizeGenerationOutput = ({
  wmTaskId,
  providerTaskId,
  previousOutput,
  rawOutput,
}: {
  wmTaskId: string;
  providerTaskId?: string | null;
  previousOutput?: unknown;
  rawOutput?: unknown;
}) => {
  const previous = asObject(previousOutput);
  const raw = asObject(rawOutput);
  const resolvedTaskId =
    providerTaskId ??
    readString(raw.taskId) ??
    readString(previous.providerTaskId) ??
    readString(previous.taskId);

  return {
    ...previous,
    ...raw,
    wmTaskId,
    providerTaskId: resolvedTaskId,
    taskId: resolvedTaskId,
    providerMetadata: {
      rawOutput: rawOutput ?? null,
    },
  };
};

export const withLifecyclePhase = ({
  output,
  status,
}: {
  output: unknown;
  status: GenerationInternalStatus;
}) => ({
  ...asObject(output),
  lifecyclePhase: status,
});

export const resolveGenerationSubmitTransition = ({
  generationId,
  providerStatus,
  providerTaskId,
  requestedQuality,
  previousOutput,
  providerOutput,
  providerError,
}: {
  generationId: string;
  providerStatus: ProviderGenerationStatus;
  providerTaskId?: string | null;
  requestedQuality?: '1080p' | '4k' | null;
  previousOutput?: unknown;
  providerOutput?: unknown;
  providerError?: string | null;
}) => {
  const normalizedOutput = normalizeGenerationOutput({
    wmTaskId: generationId,
    providerTaskId,
    previousOutput,
    rawOutput: providerOutput,
  });

  if (providerStatus === 'failed') {
    return {
      status: 'failed' as const,
      publicStatus: getPublicGenerationStatus('failed'),
      error: providerError ?? null,
      output: withLifecyclePhase({
        output: normalizedOutput,
        status: 'failed',
      }),
    };
  }

  if (providerStatus === 'pending') {
    return {
      status: 'queued' as const,
      publicStatus: getPublicGenerationStatus('queued'),
      error: providerError ?? null,
      output: withLifecyclePhase({
        output: normalizedOutput,
        status: 'queued',
      }),
    };
  }

  if (providerStatus === 'processing') {
    return {
      status: 'processing' as const,
      publicStatus: getPublicGenerationStatus('processing'),
      error: providerError ?? null,
      output: withLifecyclePhase({
        output: normalizedOutput,
        status: 'processing',
      }),
    };
  }

  if (requestedQuality) {
    return {
      status: 'finalizing' as const,
      publicStatus: getPublicGenerationStatus('finalizing'),
      error: providerError ?? null,
      output: withLifecyclePhase({
        output: {
          ...withBaseResultUrl(normalizedOutput),
          quality_finalized: false,
        },
        status: 'finalizing',
      }),
    };
  }

  return {
    status: 'succeeded' as const,
    publicStatus: getPublicGenerationStatus('succeeded'),
    error: providerError ?? null,
    output: withLifecyclePhase({
      output: {
        ...normalizedOutput,
        quality_finalized: true,
      },
      status: 'succeeded',
    }),
  };
};

export const resolveProviderSyncTransition = ({
  generationId,
  previousOutput,
  providerStatus,
  providerTaskId,
  providerOutput,
  providerError,
  requestedQuality,
}: {
  generationId: string;
  previousOutput?: unknown;
  providerStatus: ProviderGenerationStatus;
  providerTaskId?: string | null;
  providerOutput?: unknown;
  providerError?: string | null;
  requestedQuality?: '1080p' | '4k' | null;
}) =>
  resolveGenerationSubmitTransition({
    generationId,
    previousOutput,
    providerStatus,
    providerTaskId,
    providerOutput,
    providerError,
    requestedQuality,
  });

export const resolveTimeoutTransition = ({
  generationId,
  output,
}: {
  generationId: string;
  output?: unknown;
}) => {
  const currentOutput = asObject(output);
  const baseResultUrl = readString(currentOutput.base_result_url);

  if (baseResultUrl) {
    return {
      status: 'succeeded' as const,
      publicStatus: getPublicGenerationStatus('succeeded'),
      error: 'Final-quality task timed out, delivered base-quality fallback.',
      output: withLifecyclePhase({
        output: withFallbackFromBase(currentOutput),
        status: 'succeeded',
      }),
    };
  }

  return {
    status: 'timed_out' as const,
    publicStatus: getPublicGenerationStatus('timed_out'),
    error: EFFECTS_GENERATION_TIMEOUT_MESSAGE,
    output: withLifecyclePhase({
      output: { ...currentOutput, wmTaskId: generationId },
      status: 'timed_out',
    }),
  };
};
