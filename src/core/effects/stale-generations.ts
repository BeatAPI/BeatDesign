import { and, inArray, lt } from 'drizzle-orm';
import { generationHistory } from '@/config/db/schema';
import { resolveTimeoutTransition } from '@/core/effects/generation-orchestrator';
import { updateGenerationById } from '@/core/effects/record-generation';
import { EFFECTS_GENERATION_TIMEOUT_MS, EFFECTS_GENERATION_TIMEOUT_MESSAGE } from '@/core/effects/runtime-config';
import { getDb } from '@/core/workspace-lib/db-adapter';

export const STALE_GENERATION_TIMEOUT_MS = EFFECTS_GENERATION_TIMEOUT_MS;
export const STALE_GENERATION_ERROR_MESSAGE = EFFECTS_GENERATION_TIMEOUT_MESSAGE;

export function isGenerationStale({ createdAt, now = new Date() }: { createdAt: Date; now?: Date }) {
  return now.getTime() - createdAt.getTime() >= STALE_GENERATION_TIMEOUT_MS;
}

export function resolveStaleGenerationTransition({
  generationId,
  output,
}: {
  generationId: string;
  output?: unknown;
}) {
  return resolveTimeoutTransition({ generationId, output });
}

export async function cleanupStaleGenerations({ now = new Date() } = {}) {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - STALE_GENERATION_TIMEOUT_MS);
  const rows = await db
    .select({ id: generationHistory.id, output: generationHistory.output })
    .from(generationHistory)
    .where(
      and(
        inArray(generationHistory.status, ['pending', 'processing']),
        lt(generationHistory.createdAt, cutoff)
      )
    );
  for (const row of rows) {
    const transition = resolveStaleGenerationTransition({ generationId: row.id, output: row.output });
    await updateGenerationById({
      id: row.id,
      status: transition.publicStatus,
      output: transition.output,
      error: transition.error ?? STALE_GENERATION_ERROR_MESSAGE,
    });
  }
  return {
    checked: rows.length,
    updated: rows.length,
    scannedCount: rows.length,
    processedCount: rows.length,
    failedCount: rows.length,
    succeededCount: 0,
    errorCount: 0,
  };
}
