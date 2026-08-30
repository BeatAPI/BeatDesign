import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';

import { projectCommandReceipt } from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';

import {
  BeatDesignCommandError,
  type BeatDesignCommandResult,
} from './contracts';
import type { BeatDesignCommandData } from './executor';

export type StoredCommandResult = BeatDesignCommandResult<BeatDesignCommandData>;

const RECEIPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RECEIPTS_PER_PROJECT = 2_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const lastCleanupByProject = new Map<string, number>();

async function cleanupCommandReceipts(projectId: string) {
  const now = Date.now();
  const lastCleanup = lastCleanupByProject.get(projectId) ?? 0;
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanupByProject.set(projectId, now);

  const db = await getDb();
  const overflow = await db
    .select({ id: projectCommandReceipt.id })
    .from(projectCommandReceipt)
    .where(eq(projectCommandReceipt.projectId, projectId))
    .orderBy(desc(projectCommandReceipt.createdAt))
    .limit(500)
    .offset(MAX_RECEIPTS_PER_PROJECT);
  const overflowIds = overflow.map((receipt: { id: string }) => receipt.id);
  await db
    .delete(projectCommandReceipt)
    .where(
      and(
        eq(projectCommandReceipt.projectId, projectId),
        or(
          lt(
            projectCommandReceipt.createdAt,
            new Date(now - RECEIPT_RETENTION_MS)
          ),
          overflowIds.length > 0
            ? inArray(projectCommandReceipt.id, overflowIds)
            : undefined
        )
      )
    );
}

export async function loadCommandReceipt({
  projectId,
  idempotencyKey,
}: {
  projectId: string;
  idempotencyKey: string;
}) {
  const record = await loadCommandReceiptRecord({ projectId, idempotencyKey });
  return record?.result ?? null;
}

export async function listCommandReceipts({
  projectId,
  limit = 50,
}: {
  projectId: string;
  limit?: number;
}) {
  const db = await getDb();
  return db
    .select({
      commandId: projectCommandReceipt.commandId,
      idempotencyKey: projectCommandReceipt.idempotencyKey,
      origin: projectCommandReceipt.origin,
      commandType: projectCommandReceipt.commandType,
      result: projectCommandReceipt.resultJson,
      createdAt: projectCommandReceipt.createdAt,
    })
    .from(projectCommandReceipt)
    .where(eq(projectCommandReceipt.projectId, projectId))
    .orderBy(desc(projectCommandReceipt.createdAt))
    .limit(Math.max(1, Math.min(200, Math.floor(limit))));
}

export async function loadCommandReceiptRecord({
  projectId,
  idempotencyKey,
}: {
  projectId: string;
  idempotencyKey: string;
}) {
  const db = await getDb();
  const rows = await db
    .select({
      commandId: projectCommandReceipt.commandId,
      commandType: projectCommandReceipt.commandType,
      resultJson: projectCommandReceipt.resultJson,
    })
    .from(projectCommandReceipt)
    .where(
      and(
        eq(projectCommandReceipt.projectId, projectId),
        eq(projectCommandReceipt.idempotencyKey, idempotencyKey)
      )
    )
    .limit(1);
  const row = rows[0];
  return row
    ? {
        commandId: row.commandId,
        commandType: row.commandType,
        result: row.resultJson as StoredCommandResult,
      }
    : null;
}

export async function storeCommandReceipt({
  projectId,
  idempotencyKey,
  commandId,
  origin,
  commandType,
  result,
}: {
  projectId: string;
  idempotencyKey: string;
  commandId: string;
  origin: string;
  commandType: string;
  result: StoredCommandResult;
}) {
  const db = await getDb();
  await db
    .insert(projectCommandReceipt)
    .values({
      id: randomUUID(),
      projectId,
      idempotencyKey,
      commandId,
      origin,
      commandType,
      resultJson: result,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
  await cleanupCommandReceipts(projectId);
  const stored = await loadCommandReceiptRecord({ projectId, idempotencyKey });
  if (
    stored &&
    (stored.commandId !== commandId || stored.commandType !== commandType)
  ) {
    throw new BeatDesignCommandError(
      'INVALID_COMMAND',
      'Idempotency key is already bound to a different command.'
    );
  }
  return stored?.result ?? result;
}
