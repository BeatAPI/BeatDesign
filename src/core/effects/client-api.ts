export type EffectClientStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

export type EffectClientResponse<T extends Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T;
};

type BaseEffectPayload = {
  effectId: number;
  input: Record<string, unknown>;
  projectId?: string;
  expectedUploadCount?: number;
  generationIntentToken?: string;
};

export type PrecheckResponse = {
  error?: string;
  uploadIntentToken?: string;
};

type GenerateResponse = {
  status?: EffectClientStatus;
  wmTaskId?: string;
  output?: unknown;
  error?: string;
};

type StatusResponse = {
  status?: EffectClientStatus;
  output?: unknown;
  error?: string;
};

export type EffectMetadata = {
  id: number;
  name: string;
  provider?: string | null;
  inputSchema?: unknown;
};

type EffectsMetadataResponse = {
  effects?: Record<string, EffectMetadata>;
  error?: string;
};

const safeJson = async <T extends Record<string, unknown>>(
  response: Response
): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
};

export const precheckEffect = async (
  payload: BaseEffectPayload
): Promise<EffectClientResponse<PrecheckResponse>> => {
  const response = await fetch('/api/effects/precheck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await safeJson<PrecheckResponse>(response),
  };
};

export const generateEffect = async (
  payload: BaseEffectPayload
): Promise<EffectClientResponse<GenerateResponse>> => {
  const response = await fetch('/api/effects/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await safeJson<GenerateResponse>(response),
  };
};

export const getEffectStatus = async (params: {
  wmTaskId: string;
  effectId: number;
  syncProvider?: 0 | 1;
}): Promise<EffectClientResponse<StatusResponse>> => {
  const query = new URLSearchParams({
    wmTaskId: params.wmTaskId,
    effectId: String(params.effectId),
    syncProvider: String(params.syncProvider ?? 1),
  });

  const response = await fetch(`/api/effects/status?${query.toString()}`);

  return {
    ok: response.ok,
    status: response.status,
    data: await safeJson<StatusResponse>(response),
  };
};

export const getEffectsMetadata = async (
  ids: number[]
): Promise<EffectClientResponse<EffectsMetadataResponse>> => {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id));
  const query = new URLSearchParams({
    ids: uniqueIds.join(','),
  });

  const response = await fetch(`/api/effects/metadata?${query.toString()}`);

  return {
    ok: response.ok,
    status: response.status,
    data: await safeJson<EffectsMetadataResponse>(response),
  };
};

export const resolveWmTaskId = (payload: {
  wmTaskId?: string;
  output?: unknown;
}): string | null => {
  if (typeof payload.wmTaskId === 'string' && payload.wmTaskId) {
    return payload.wmTaskId;
  }

  if (payload.output && typeof payload.output === 'object') {
    const outputRecord = payload.output as Record<string, unknown>;
    if (typeof outputRecord.wmTaskId === 'string' && outputRecord.wmTaskId) {
      return outputRecord.wmTaskId;
    }
  }

  return null;
};
