
import { randomUUID } from 'crypto';
import { getDb } from '@/core/workspace-lib/db-adapter';
import {
  generationAssetLink,
  generationHistory,
  project,
  projectAssetMembership,
  userAsset,
} from '@/config/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export type AssetType = 'image' | 'video' | 'audio';
export type AssetSource = 'upload' | 'provider' | 'derived';
export type AssetRole = 'input' | 'output' | 'thumbnail' | 'reference';
export type ProjectAssetRole = 'upload' | 'reference' | 'generated' | 'cover';

function shouldSyncProjectCoverAsset({
  role,
  assetType,
}: {
  role: ProjectAssetRole;
  assetType: AssetType;
}) {
  return (
    assetType === 'image' &&
    (role === 'cover' || role === 'generated' || role === 'upload')
  );
}

async function syncProjectCoverAsset({
  projectId,
  assetId,
}: {
  projectId: string;
  assetId: string;
}) {
  const db = await getDb();
  await db
    .update(project)
    .set({
      coverAssetId: assetId,
      updatedAt: new Date(),
    })
    .where(eq(project.id, projectId));
}

export const recordUserAsset = async ({
  id: requestedId,
  type,
  source,
  bucket,
  objectKey,
  publicUrl,
  mimeType,
  sizeBytes,
  sha256,
  filename,
  storageProvider,
  assetClass,
  originProjectId,
  width,
  height,
  durationMs,
  thumbnailAssetId,
  metadata,
}: {
  id?: string;
  type: AssetType;
  source: AssetSource;
  bucket: string;
  objectKey: string;
  publicUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  filename?: string;
  storageProvider?: string;
  assetClass?: string;
  originProjectId?: string | null;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailAssetId?: string | null;
  metadata?: unknown;
}) => {
  const db = await getDb();
  const existing = await db
    .select({ id: userAsset.id })
    .from(userAsset)
    .where(
      and(eq(userAsset.bucket, bucket), eq(userAsset.objectKey, objectKey))
    )
    .limit(1);

  if (existing[0]?.id) {
    return existing[0].id;
  }

  const id = requestedId ?? randomUUID();
  const resolvedAssetClass =
    assetClass ??
    (source === 'upload'
      ? 'original'
      : source === 'provider'
        ? 'generated'
        : 'derived');

  await db.insert(userAsset).values({
    id,
    type,
    source,
    assetClass: resolvedAssetClass,
    storageProvider: storageProvider ?? null,
    bucket,
    objectKey,
    publicUrl,
    filename: filename ?? null,
    mimeType: mimeType ?? null,
    sizeBytes: sizeBytes ?? null,
    sha256: sha256 ?? null,
    width: width ?? null,
    height: height ?? null,
    durationMs: durationMs ?? null,
    originProjectId: originProjectId ?? null,
    thumbnailAssetId: thumbnailAssetId ?? null,
    metadata: metadata ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
};

export const getProjectAssetById = async ({
  projectId,
  assetId,
}: {
  projectId: string;
  assetId: string;
}) => {
  const db = await getDb();
  const rows = await db
    .select({
      id: userAsset.id,
      type: userAsset.type,
      storageProvider: userAsset.storageProvider,
      bucket: userAsset.bucket,
      objectKey: userAsset.objectKey,
      publicUrl: userAsset.publicUrl,
      filename: userAsset.filename,
      mimeType: userAsset.mimeType,
      sizeBytes: userAsset.sizeBytes,
      source: userAsset.source,
      assetClass: userAsset.assetClass,
      width: userAsset.width,
      height: userAsset.height,
      durationMs: userAsset.durationMs,
      metadata: userAsset.metadata,
    })
    .from(projectAssetMembership)
    .innerJoin(userAsset, eq(userAsset.id, projectAssetMembership.assetId))
    .where(
      and(
        eq(projectAssetMembership.projectId, projectId),
        eq(projectAssetMembership.assetId, assetId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
};

export const listProjectAssets = async ({
  projectId,
  limit = 100,
}: {
  projectId: string;
  limit?: number;
}) => {
  const db = await getDb();
  return db
    .select({
      id: userAsset.id,
      type: userAsset.type,
      source: userAsset.source,
      assetClass: userAsset.assetClass,
      publicUrl: userAsset.publicUrl,
      filename: userAsset.filename,
      mimeType: userAsset.mimeType,
      sizeBytes: userAsset.sizeBytes,
      width: userAsset.width,
      height: userAsset.height,
      durationMs: userAsset.durationMs,
      category: projectAssetMembership.category,
      createdAt: projectAssetMembership.createdAt,
    })
    .from(projectAssetMembership)
    .innerJoin(userAsset, eq(userAsset.id, projectAssetMembership.assetId))
    .where(eq(projectAssetMembership.projectId, projectId))
    .orderBy(projectAssetMembership.createdAt)
    .limit(Math.max(1, Math.min(500, Math.floor(limit))));
};

export const deleteUserAssetById = async (assetId: string) => {
  const db = await getDb();
  await db.delete(userAsset).where(eq(userAsset.id, assetId));
};

export const linkGenerationAsset = async ({
  generationId,
  assetId,
  role,
}: {
  generationId: string;
  assetId: string;
  role: AssetRole;
}) => {
  const db = await getDb();
  const existing = await db
    .select({ id: generationAssetLink.id })
    .from(generationAssetLink)
    .where(
      and(
        eq(generationAssetLink.generationId, generationId),
        eq(generationAssetLink.assetId, assetId),
        eq(generationAssetLink.role, role)
      )
    )
    .limit(1);

  if (existing[0]?.id) {
    return existing[0].id;
  }

  const id = randomUUID();
  await db.insert(generationAssetLink).values({
    id,
    generationId,
    assetId,
    role,
    createdAt: new Date(),
  });

  const generationRows = await db
    .select({ projectId: generationHistory.projectId })
    .from(generationHistory)
    .where(eq(generationHistory.id, generationId))
    .limit(1);

  const linkedProjectId = generationRows[0]?.projectId;
  if (role === 'output') {
    await db
      .update(generationHistory)
      .set({
        resultAssetId: assetId,
      })
      .where(eq(generationHistory.id, generationId));
  }

  if (linkedProjectId) {
    await db
      .update(userAsset)
      .set({
        originProjectId: linkedProjectId,
      })
      .where(and(eq(userAsset.id, assetId), isNull(userAsset.originProjectId)));

    await linkProjectAsset({
      projectId: linkedProjectId,
      assetId,
      role:
        role === 'output' || role === 'thumbnail' ? 'generated' : 'reference',
      sourceRunId: generationId,
    });
  }

  return id;
};

export const linkGenerationInputAssetsByUrls = async ({
  generationId,
  urls,
}: {
  generationId: string;
  urls: string[];
}) => {
  const normalizedUrls = urls
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (normalizedUrls.length === 0) {
    return;
  }

  const db = await getDb();
  const assets = await db
    .select({ id: userAsset.id })
    .from(userAsset)
    .where(inArray(userAsset.publicUrl, normalizedUrls));

  for (const asset of assets) {
    await linkGenerationAsset({
      generationId,
      assetId: asset.id,
      role: 'input',
    });
  }
};

export const getProjectAssetUrls = async ({
  projectId,
  urls,
}: {
  projectId: string;
  urls: string[];
}) => {
  const normalizedUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (normalizedUrls.length === 0) return [];

  const db = await getDb();
  const rows = await db
    .select({ publicUrl: userAsset.publicUrl })
    .from(projectAssetMembership)
    .innerJoin(userAsset, eq(userAsset.id, projectAssetMembership.assetId))
    .where(
      and(
        eq(projectAssetMembership.projectId, projectId),
        inArray(userAsset.publicUrl, normalizedUrls)
      )
    );
  return rows.map((row: { publicUrl: string }) => row.publicUrl);
};

export const linkProjectAsset = async ({
  projectId,
  assetId,
  role,
  sourceRunId,
  workflowType,
  workflowInstanceId,
  slotId,
  assetRole,
  metadata,
}: {
  projectId: string;
  assetId: string;
  role: ProjectAssetRole;
  sourceRunId?: string | null;
  workflowType?: string | null;
  workflowInstanceId?: string | null;
  slotId?: string | null;
  assetRole?: string | null;
  metadata?: unknown;
}) => {
  const db = await getDb();
  const assetRows = await db
    .select({
      id: userAsset.id,
      type: userAsset.type,
    })
    .from(userAsset)
    .where(eq(userAsset.id, assetId))
    .limit(1);
  const targetAsset = assetRows[0];

  if (!targetAsset) {
    throw new Error('Asset not found');
  }

  const existing = await db
    .select({ id: projectAssetMembership.id })
    .from(projectAssetMembership)
    .where(
      and(
        eq(projectAssetMembership.projectId, projectId),
        eq(projectAssetMembership.assetId, assetId),
        eq(projectAssetMembership.category, role)
      )
    )
    .limit(1);

  if (existing[0]?.id) {
    if (
      shouldSyncProjectCoverAsset({
        role,
        assetType: targetAsset.type as AssetType,
      })
    ) {
      await syncProjectCoverAsset({ projectId, assetId });
    }
    return existing[0].id;
  }

  const id = randomUUID();
  await db.insert(projectAssetMembership).values({
    id,
    projectId,
    assetId,
    category: role,
    sourceRunId: sourceRunId ?? null,
    workflowType: workflowType ?? null,
    workflowInstanceId: workflowInstanceId ?? null,
    slotId: slotId ?? null,
    role: assetRole ?? null,
    metadata: metadata ?? null,
    createdAt: new Date(),
  });

  if (
    shouldSyncProjectCoverAsset({
      role,
      assetType: targetAsset.type as AssetType,
    })
  ) {
    await syncProjectCoverAsset({ projectId, assetId });
  }

  return id;
};
