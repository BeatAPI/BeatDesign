import { randomUUID } from 'crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { generationHistory } from '@/config/db/schema';
import { deriveGenerationOperationalFields } from '@/core/effects/generation-operational-fields';
import { getDb } from '@/core/workspace-lib/db-adapter';

export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

const RUNNING_STATUSES: GenerationStatus[] = ['pending', 'processing'];
const TERMINAL_STATUSES: GenerationStatus[] = ['succeeded', 'failed'];

const extractPrompt = (input: unknown) => {
  if (!input || typeof input !== 'object') return null;
  const prompt = (input as Record<string, unknown>).prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : null;
};

export async function recordGeneration({
  projectId,
  effectId,
  status,
  input,
  output,
  error,
}: {
  projectId?: string | null;
  effectId: number;
  status: GenerationStatus;
  input?: unknown;
  output?: unknown;
  error?: string | null;
}) {
  const id = randomUUID();
  try {
    const db = await getDb();
    const now = new Date();
    const operational = deriveGenerationOperationalFields({ output });
    await db.insert(generationHistory).values({
      id,
      projectId: projectId ?? null,
      effectId,
      status,
      providerTaskId: operational.providerTaskId ?? null,
      lifecyclePhase: operational.lifecyclePhase ?? null,
      lastProviderSyncAt: operational.lastProviderSyncAt ?? null,
      executionMode: 'create_new',
      submittedPrompt: extractPrompt(input),
      submittedParams: input ?? null,
      input: input ?? null,
      output: output ?? null,
      error: error ?? null,
      startedAt: now,
      completedAt: status === 'succeeded' ? now : null,
      failedAt: status === 'failed' ? now : null,
      createdAt: now,
    });
    return id;
  } catch (cause) {
    console.error('recordGeneration error:', cause);
    return null;
  }
}

export async function countRunningGenerationsForProject(projectId: string) {
  const db = await getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(generationHistory)
    .where(
      and(
        eq(generationHistory.projectId, projectId),
        inArray(generationHistory.status, RUNNING_STATUSES)
      )
    );
  return Number(rows[0]?.count ?? 0);
}

export async function findActiveProject() {
  const db = await getDb();
  const rows = await db
    .select({ projectId: generationHistory.projectId })
    .from(generationHistory)
    .where(inArray(generationHistory.status, RUNNING_STATUSES))
    .orderBy(desc(generationHistory.createdAt))
    .limit(1);
  return rows[0]?.projectId ?? null;
}

export async function updateGenerationById({
  id,
  status,
  output,
  error,
}: {
  id: string;
  status: GenerationStatus;
  output?: unknown;
  error?: string | null;
}) {
  try {
    const db = await getDb();
    const now = new Date();
    const operational = deriveGenerationOperationalFields({ output });
    const values = {
      status,
      providerTaskId: operational.providerTaskId ?? null,
      lifecyclePhase: operational.lifecyclePhase ?? null,
      lastProviderSyncAt: operational.lastProviderSyncAt ?? null,
      output: output ?? null,
      error: error ?? null,
      completedAt: status === 'succeeded' ? now : null,
      failedAt: status === 'failed' ? now : null,
    };
    await db
      .update(generationHistory)
      .set(values)
      .where(
        and(
          eq(generationHistory.id, id),
          status === 'pending' || status === 'processing'
            ? inArray(generationHistory.status, RUNNING_STATUSES)
            : inArray(generationHistory.status, [
                ...RUNNING_STATUSES,
                ...TERMINAL_STATUSES,
              ])
        )
      );
    return true;
  } catch (cause) {
    console.error('updateGenerationById error:', cause);
    return false;
  }
}

export async function getGenerationById({
  id,
  effectId,
}: {
  id: string;
  effectId?: number;
}) {
  const db = await getDb();
  const conditions = [eq(generationHistory.id, id)];
  if (effectId !== undefined) {
    conditions.push(eq(generationHistory.effectId, effectId));
  }
  const rows = await db
    .select()
    .from(generationHistory)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

export async function getGenerationByProviderTaskId(taskId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(generationHistory)
    .where(eq(generationHistory.providerTaskId, taskId))
    .orderBy(desc(generationHistory.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
