import { randomUUID } from 'node:crypto';

import { and, eq, gt, inArray, lte, sql } from 'drizzle-orm';

import {
  generationIntentUpload,
  generationUploadIntent,
} from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';

const INTENT_TTL_MS = 10 * 60 * 1000;
export const MAX_GENERATION_UPLOADS = 50;
export const MAX_ACTIVE_GENERATION_INTENTS_PER_PROJECT = 7;
export const MAX_ACTIVE_UPLOAD_INTENTS_PER_PROJECT = 2;

export class GenerationIntentQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationIntentQuotaError';
  }
}

type DbClient = Awaited<ReturnType<typeof getDb>>;

type CompletedUpload = {
  slotId: string;
  provider: 'beatapi' | 's3';
  bucket: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

const getAffectedRows = (result: unknown) => {
  if (!result || typeof result !== 'object') return 0;
  const record = result as {
    rowsAffected?: unknown;
    changes?: unknown;
    meta?: { changes?: unknown };
  };
  if (typeof record.rowsAffected === 'number') return record.rowsAffected;
  if (typeof record.changes === 'number') return record.changes;
  if (typeof record.meta?.changes === 'number') return record.meta.changes;
  return 0;
};

const resolveDb = async (dbClient?: DbClient) => dbClient ?? getDb();

export const normalizeExpectedUploadCount = (value: unknown) => {
  if (value === undefined) return 0;
  if (!Number.isInteger(value)) return null;
  const count = Number(value);
  return count >= 0 && count <= MAX_GENERATION_UPLOADS ? count : null;
};

export async function issueGenerationUploadIntent({
  projectId,
  effectId,
  expectedUploadCount,
  now = new Date(),
  dbClient,
}: {
  projectId: string;
  effectId: number;
  expectedUploadCount: number;
  now?: Date;
  dbClient?: DbClient;
}) {
  const normalizedCount = normalizeExpectedUploadCount(expectedUploadCount);
  if (!projectId || !Number.isFinite(effectId) || normalizedCount === null) {
    throw new Error('A valid project, effect, and upload count are required');
  }

  const db = await resolveDb(dbClient);
  const activeIntents = await db
    .select({ expectedUploadCount: generationUploadIntent.expectedUploadCount })
    .from(generationUploadIntent)
    .where(
      and(
        eq(generationUploadIntent.projectId, projectId),
        inArray(generationUploadIntent.status, ['pending', 'submitting']),
        gt(generationUploadIntent.expiresAt, now)
      )
    );
  if (activeIntents.length >= MAX_ACTIVE_GENERATION_INTENTS_PER_PROJECT) {
    throw new GenerationIntentQuotaError(
      'Too many pending generations for this project. Finish one or wait for an authorization to expire.'
    );
  }
  if (
    normalizedCount > 0 &&
    activeIntents.filter(
      (intent: { expectedUploadCount: number }) =>
        intent.expectedUploadCount > 0
    ).length >=
      MAX_ACTIVE_UPLOAD_INTENTS_PER_PROJECT
  ) {
    throw new GenerationIntentQuotaError(
      'Too many pending upload authorizations for this project. Finish one or wait for it to expire.'
    );
  }
  const id = randomUUID();
  await db.insert(generationUploadIntent).values({
    id,
    projectId,
    effectId,
    status: 'pending',
    expectedUploadCount: normalizedCount,
    reservedUploadCount: 0,
    completedUploadCount: 0,
    expiresAt: new Date(now.getTime() + INTENT_TTL_MS),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function claimGenerationUploadSlot({
  intentId,
  projectId,
  now = new Date(),
  dbClient,
}: {
  intentId: string;
  projectId: string;
  now?: Date;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  const result = await db
    .update(generationUploadIntent)
    .set({
      reservedUploadCount: sql`${generationUploadIntent.reservedUploadCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        eq(generationUploadIntent.projectId, projectId),
        eq(generationUploadIntent.status, 'pending'),
        gt(generationUploadIntent.expiresAt, now),
        sql`${generationUploadIntent.reservedUploadCount} < ${generationUploadIntent.expectedUploadCount}`
      )
    );

  if (getAffectedRows(result) !== 1) return null;

  const slotId = randomUUID();
  try {
    await db.insert(generationIntentUpload).values({
      id: slotId,
      intentId,
      status: 'reserved',
      createdAt: now,
    });
  } catch (error) {
    await db
      .update(generationUploadIntent)
      .set({
        reservedUploadCount: sql`max(${generationUploadIntent.reservedUploadCount} - 1, 0)`,
        updatedAt: now,
      })
      .where(eq(generationUploadIntent.id, intentId));
    throw error;
  }
  return slotId;
}

export async function getGenerationUploadIntentEffectId({
  intentId,
  projectId,
  dbClient,
}: {
  intentId: string;
  projectId: string;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  const [intent] = await db
    .select({ effectId: generationUploadIntent.effectId })
    .from(generationUploadIntent)
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        eq(generationUploadIntent.projectId, projectId)
      )
    )
    .limit(1);

  return intent?.effectId ?? null;
}

export async function releaseGenerationUploadSlot({
  intentId,
  slotId,
  now = new Date(),
  dbClient,
}: {
  intentId: string;
  slotId: string;
  now?: Date;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  const removed = await db
    .delete(generationIntentUpload)
    .where(
      and(
        eq(generationIntentUpload.id, slotId),
        eq(generationIntentUpload.intentId, intentId),
        eq(generationIntentUpload.status, 'reserved')
      )
    );
  if (getAffectedRows(removed) !== 1) return false;

  await db
    .update(generationUploadIntent)
    .set({
      reservedUploadCount: sql`max(${generationUploadIntent.reservedUploadCount} - 1, 0)`,
      updatedAt: now,
    })
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        eq(generationUploadIntent.status, 'pending')
      )
    );
  return true;
}

export async function completeGenerationUploadSlot({
  intentId,
  upload,
  now = new Date(),
  dbClient,
}: {
  intentId: string;
  upload: CompletedUpload;
  now?: Date;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  const completed = await db
    .update(generationIntentUpload)
    .set({
      status: 'uploaded',
      storageProvider: upload.provider,
      bucket: upload.bucket,
      objectKey: upload.key,
      publicUrl: upload.url,
      filename: upload.filename,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      completedAt: now,
    })
    .where(
      and(
        eq(generationIntentUpload.id, upload.slotId),
        eq(generationIntentUpload.intentId, intentId),
        eq(generationIntentUpload.status, 'reserved')
      )
    );
  if (getAffectedRows(completed) !== 1) return false;

  const updated = await db
    .update(generationUploadIntent)
    .set({
      completedUploadCount: sql`${generationUploadIntent.completedUploadCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        eq(generationUploadIntent.status, 'pending'),
        gt(generationUploadIntent.expiresAt, now)
      )
    );
  return getAffectedRows(updated) === 1;
}

export async function consumeGenerationUploadIntent({
  intentId,
  projectId,
  effectId,
  referencedUrls,
  authorizedProjectUrls = [],
  now = new Date(),
  dbClient,
}: {
  intentId: string;
  projectId: string;
  effectId: number;
  referencedUrls: string[];
  authorizedProjectUrls?: string[];
  now?: Date;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  const rows = await db
    .select()
    .from(generationUploadIntent)
    .where(eq(generationUploadIntent.id, intentId))
    .limit(1);
  const intent = rows[0];
  if (
    !intent ||
    intent.projectId !== projectId ||
    intent.effectId !== effectId ||
    intent.status !== 'pending' ||
    intent.expiresAt <= now ||
    intent.reservedUploadCount !== intent.expectedUploadCount ||
    intent.completedUploadCount !== intent.expectedUploadCount
  ) {
    return null;
  }

  const uploads = await db
    .select({ publicUrl: generationIntentUpload.publicUrl })
    .from(generationIntentUpload)
    .where(
      and(
        eq(generationIntentUpload.intentId, intentId),
        eq(generationIntentUpload.status, 'uploaded')
      )
    );
  const referenced = new Set(referencedUrls);
  const uploadedUrls = new Set(
    uploads
      .map((upload: { publicUrl: string | null }) => upload.publicUrl)
      .filter((url: string | null): url is string => Boolean(url))
  );
  const previouslyUploadedUrls = await getProjectCompletedIntentUploadUrls({
    projectId,
    urls: referencedUrls,
    dbClient: db,
  });
  const authorized = new Set([
    ...uploadedUrls,
    ...authorizedProjectUrls,
    ...previouslyUploadedUrls,
  ]);
  if (
    uploads.length !== intent.expectedUploadCount ||
    uploads.some(
      (upload: { publicUrl: string | null }) =>
        !upload.publicUrl || !referenced.has(upload.publicUrl)
    ) ||
    [...referenced].some((url) => !authorized.has(url))
  ) {
    return null;
  }

  const consumed = await db
    .update(generationUploadIntent)
    .set({ status: 'submitting', updatedAt: now })
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        eq(generationUploadIntent.status, 'pending'),
        gt(generationUploadIntent.expiresAt, now),
        eq(
          generationUploadIntent.reservedUploadCount,
          intent.expectedUploadCount
        ),
        eq(
          generationUploadIntent.completedUploadCount,
          intent.expectedUploadCount
        )
      )
    );
  return getAffectedRows(consumed) === 1 ? intent : null;
}

export async function getProjectCompletedIntentUploadUrls({
  projectId,
  urls,
  dbClient,
}: {
  projectId: string;
  urls: string[];
  dbClient?: DbClient;
}) {
  const normalizedUrls = [
    ...new Set(urls.map((url) => url.trim()).filter(Boolean)),
  ];
  if (!projectId || normalizedUrls.length === 0) return [];

  const db = await resolveDb(dbClient);
  const rows = await db
    .select({ publicUrl: generationIntentUpload.publicUrl })
    .from(generationIntentUpload)
    .innerJoin(
      generationUploadIntent,
      eq(generationIntentUpload.intentId, generationUploadIntent.id)
    )
    .where(
      and(
        eq(generationUploadIntent.projectId, projectId),
        eq(generationIntentUpload.status, 'uploaded'),
        inArray(generationIntentUpload.publicUrl, normalizedUrls)
      )
    );

  return rows
    .map((row: { publicUrl: string | null }) => row.publicUrl)
    .filter((url: string | null): url is string => Boolean(url));
}

export async function getCompletedIntentUploads({
  intentId,
  dbClient,
}: {
  intentId: string;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  return db
    .select()
    .from(generationIntentUpload)
    .where(
      and(
        eq(generationIntentUpload.intentId, intentId),
        eq(generationIntentUpload.status, 'uploaded')
      )
    );
}

export async function completeGenerationUploadIntent({
  intentId,
  generationId,
  now = new Date(),
  dbClient,
}: {
  intentId: string;
  generationId: string;
  now?: Date;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  const result = await db
    .update(generationUploadIntent)
    .set({
      status: 'consumed',
      generationId,
      consumedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        eq(generationUploadIntent.status, 'submitting')
      )
    );
  return getAffectedRows(result) === 1;
}

export async function failGenerationUploadIntent({
  intentId,
  now = new Date(),
  dbClient,
}: {
  intentId: string;
  now?: Date;
  dbClient?: DbClient;
}) {
  const db = await resolveDb(dbClient);
  await db
    .update(generationUploadIntent)
    .set({ status: 'failed', updatedAt: now })
    .where(
      and(
        eq(generationUploadIntent.id, intentId),
        inArray(generationUploadIntent.status, ['pending', 'submitting'])
      )
    );
}

export async function expireGenerationUploadIntents({
  now = new Date(),
  dbClient,
}: {
  now?: Date;
  dbClient?: DbClient;
} = {}) {
  const db = await resolveDb(dbClient);
  await db
    .update(generationUploadIntent)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(generationUploadIntent.status, 'pending'),
        lte(generationUploadIntent.expiresAt, now)
      )
    );
}
