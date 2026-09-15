import { createAdapter } from '@/core/adapters/adapter-factory';
import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { generationHistory } from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { EFFECTS_POLL_INTERVAL_MS } from './runtime-config';
import { getEffectById } from '@/core/effects/effects';
import { resolveProviderSyncTransition } from '@/core/effects/generation-orchestrator';
import { persistEffectOutputIfNeeded } from '@/core/effects/output-storage';
import {
  getGenerationById,
  updateGenerationById,
} from '@/core/effects/record-generation';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

async function syncGenerationOnce({
  wmTaskId,
  effectId,
}: {
  wmTaskId: string;
  effectId: number;
}) {
  const generation = await getGenerationById({ id: wmTaskId, effectId });
  if (!generation) return { ok: false as const, status: 404, error: 'Task not found' };
  if (generation.status === 'succeeded' || generation.status === 'failed') {
    return { ok: true as const, generation };
  }
  const providerIdentity = asObject(asObject(generation.input)._provider);
  const effect = await getEffectById(
    effectId,
    readString(providerIdentity.id) ?? undefined
  );
  if (!effect) return { ok: false as const, status: 404, error: 'Model not found' };
  if (!generation.providerTaskId) {
    return { ok: true as const, generation };
  }
  const db = await getDb();
  const now = new Date();
  const claimed = await db.update(generationHistory).set({ lastProviderSyncAt: now })
    .where(and(
      eq(generationHistory.id, wmTaskId),
      inArray(generationHistory.status, ['pending', 'processing']),
      or(isNull(generationHistory.lastProviderSyncAt), lt(generationHistory.lastProviderSyncAt, new Date(now.getTime() - EFFECTS_POLL_INTERVAL_MS)))
    )).returning({ id: generationHistory.id });
  if (!claimed.length) return { ok: true as const, generation };
  const adapter = createAdapter(effect);
  if (!adapter.checkStatus) {
    return { ok: false as const, status: 400, error: 'Status check is not supported' };
  }
  const provider = await adapter.checkStatus(generation.providerTaskId);
  const transition = resolveProviderSyncTransition({
    generationId: wmTaskId,
    previousOutput: generation.output,
    providerStatus: provider.status,
    providerTaskId: generation.providerTaskId,
    providerOutput: provider.output,
    providerError: provider.error ?? null,
  });
  const output = provider.status === 'succeeded'
    ? await persistEffectOutputIfNeeded({
        output: transition.output,
        wmTaskId,
        effectId,
        effectType: effect.type,
      })
    : transition.output;
  await updateGenerationById({
    id: wmTaskId,
    status: transition.publicStatus,
    output,
    error: transition.error,
  });
  return {
    ok: true as const,
    generation: {
      ...generation,
      status: transition.publicStatus,
      output,
      error: transition.error,
      providerTaskId:
        typeof asObject(output).providerTaskId === 'string'
          ? (asObject(output).providerTaskId as string)
          : generation.providerTaskId,
    },
  };
}

const inFlight = new Map<string, ReturnType<typeof syncGenerationOnce>>();

export function syncGeneration(input: Parameters<typeof syncGenerationOnce>[0]) {
  const existing = inFlight.get(input.wmTaskId);
  if (existing) return existing;
  const task = syncGenerationOnce(input).finally(() => inFlight.delete(input.wmTaskId));
  inFlight.set(input.wmTaskId, task);
  return task;
}
