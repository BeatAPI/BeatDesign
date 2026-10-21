import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { project, projectAssetMembership, userAsset } from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { BeatDesignCommandError } from '@/core/commands/contracts';
import {
  projectSettingsPatchSchema,
  type ProjectSettings,
} from './project-settings-contract';
import { LOCAL_PROJECT_ASSET_PROVIDER } from './local-project-assets';

export async function resolveProjectCover(
  db: any,
  row: { id: string; coverMode: string; coverAssetId: string | null },
) {
  if (row.coverMode === 'manual' && row.coverAssetId) {
    const [asset] = await db
      .select({ id: userAsset.id, publicUrl: userAsset.publicUrl })
      .from(userAsset)
      .innerJoin(
        projectAssetMembership,
        eq(projectAssetMembership.assetId, userAsset.id),
      )
      .where(
        and(
          eq(projectAssetMembership.projectId, row.id),
          eq(userAsset.id, row.coverAssetId),
          eq(userAsset.type, 'image'),
        ),
      )
      .limit(1);
    if (asset) return { ...asset, mode: 'manual' as const };
  }
  // Images first, then videos. Stable order never changes on re-link or generation completion.
  const [asset] = await db
    .select({
      id: userAsset.id,
      publicUrl: userAsset.publicUrl,
      type: userAsset.type,
      storageProvider: userAsset.storageProvider,
    })
    .from(userAsset)
    .innerJoin(
      projectAssetMembership,
      eq(projectAssetMembership.assetId, userAsset.id),
    )
    .where(
      and(
        eq(projectAssetMembership.projectId, row.id),
        inArray(projectAssetMembership.category, [
          'upload',
          'generated',
          'cover',
        ]),
        or(
          eq(userAsset.type, 'image'),
          and(
            eq(userAsset.type, 'video'),
            eq(userAsset.storageProvider, LOCAL_PROJECT_ASSET_PROVIDER),
          ),
        ),
      ),
    )
    .orderBy(
      sql`case when ${userAsset.type} = 'image' then 0 else 1 end`,
      asc(userAsset.createdAt),
      asc(userAsset.id),
    )
    .limit(1);
  if (!asset) return null;
  return {
    id: asset.id,
    mode: 'auto' as const,
    publicUrl:
      asset.type === 'image'
        ? asset.publicUrl
        : asset.storageProvider === LOCAL_PROJECT_ASSET_PROVIDER
          ? `/api/app/projects/${encodeURIComponent(row.id)}/assets/${encodeURIComponent(asset.id)}/thumbnail`
          : null,
  };
}

export async function getProjectSettings(
  projectId: string,
  database?: any,
): Promise<ProjectSettings | null> {
  const db = database ?? (await getDb());
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.status, 'active')))
    .limit(1);
  if (!row) return null;
  const automaticCover = await resolveProjectCover(db, {
    ...row,
    coverMode: 'auto',
  });
  const cover =
    row.coverMode === 'manual'
      ? await resolveProjectCover(db, row)
      : automaticCover;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverMode: cover?.mode ?? 'auto',
    coverAssetId: cover?.id ?? null,
    coverImageUrl: cover?.publicUrl ?? null,
    automaticCoverImageUrl: automaticCover?.publicUrl ?? null,
    settingsRevision: row.settingsRevision,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updateProjectSettings({
  projectId,
  patch,
  expectedRevision,
  database,
}: {
  projectId: string;
  patch: unknown;
  expectedRevision?: number | null;
  database?: any;
}): Promise<ProjectSettings> {
  const parsed = projectSettingsPatchSchema.safeParse(patch);
  if (!parsed.success)
    throw new BeatDesignCommandError(
      'INVALID_COMMAND',
      parsed.error.issues[0]?.message ?? 'Invalid settings.',
    );
  if (!Number.isInteger(expectedRevision) || (expectedRevision ?? 0) < 1)
    throw new BeatDesignCommandError(
      'INVALID_COMMAND',
      'Project settings require an expectedRevision from the latest settings.',
    );
  const db = database ?? await getDb();
  const update = async (tx: any) => {
    const current = await getProjectSettings(projectId, tx);
    if (!current)
      throw new BeatDesignCommandError('NOT_FOUND', 'Project not found');
    if (current.settingsRevision !== expectedRevision) {
      const error = new Error(
        'Project settings changed. Reload before saving.',
      );
      error.name = 'ProjectSettingsVersionConflict';
      Object.assign(error, { currentVersion: current.settingsRevision });
      throw error;
    }
    const next = parsed.data;
    if (next.cover?.mode === 'manual') {
      const [asset] = await tx
        .select({ type: userAsset.type })
        .from(userAsset)
        .innerJoin(
          projectAssetMembership,
          eq(projectAssetMembership.assetId, userAsset.id),
        )
        .where(
          and(
            eq(projectAssetMembership.projectId, projectId),
            eq(userAsset.id, next.cover.assetId),
          ),
        )
        .limit(1);
      if (!asset || asset.type !== 'image')
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'Cover must be an image belonging to this project.',
        );
    }
    const changed = await tx
      .update(project)
      .set({
        ...(next.name !== undefined ? { name: next.name } : {}),
        ...(next.description !== undefined
          ? { description: next.description }
          : {}),
        ...(next.cover
          ? {
              coverMode: next.cover.mode,
              coverAssetId:
                next.cover.mode === 'manual' ? next.cover.assetId : null,
            }
          : {}),
        settingsRevision: current.settingsRevision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(project.id, projectId),
          eq(project.settingsRevision, expectedRevision as number),
          eq(project.status, 'active'),
        ),
      )
      .returning({ id: project.id });
    if (!changed.length)
      throw new BeatDesignCommandError(
        'REVISION_CONFLICT',
        'Project settings changed. Reload before saving.',
      );
    return (await getProjectSettings(projectId, tx))!;
  };
  return database ? update(database) : db.transaction(update);
}
