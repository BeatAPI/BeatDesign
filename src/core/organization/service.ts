import {
  and,
  asc,
  eq,
  exists,
  inArray,
  notInArray,
  sql,
  gt,
  or,
} from 'drizzle-orm';
import {
  projectOrganizationState,
  projectAssetMembership,
  userAsset,
} from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';
import {
  getActiveProject,
  loadProjectWithLatestSnapshot,
} from '@/core/projects/projects';
import { BeatDesignCommandError } from '@/core/commands/contracts';
import {
  emptyOrganizationDocument,
  normalizeOrganizationDocument,
  applyOrganizationOperations,
  previewFolderRemoval,
  type OrganizationOperation,
} from './organization-document';
import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import type { CanvasOperation } from '@/core/commands/canvas-commands';
import { getProjectAssetById } from '@/core/workspace-lib/assets/user-assets';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';

export async function getOrganization(projectId: string) {
  if (!(await getActiveProject({ projectId })))
    throw new BeatDesignCommandError('NOT_FOUND', 'Project not found');
  const db = await getDb();
  const [row] = await db
    .select()
    .from(projectOrganizationState)
    .where(eq(projectOrganizationState.projectId, projectId))
    .limit(1);
  return {
    document: row
      ? normalizeOrganizationDocument(row.documentJson)
      : emptyOrganizationDocument(),
    revision: row?.version ?? 0,
  };
}

export async function queryOrganizationAssets(
  projectId: string,
  input: {
    folderId?: string | null;
    scope?: 'current' | 'project';
    query?: string;
    cursor?: string;
    limit?: number;
  } = {}
) {
  const state = await getOrganization(projectId);
  const scope = input.scope ?? 'project';
  const folderId = input.folderId ?? null;
  if (scope === 'current' && folderId && !state.document.folders[folderId])
    throw new BeatDesignCommandError('NOT_FOUND', 'Folder not found');
  const filter = JSON.stringify([
    scope,
    folderId,
    input.query ?? '',
    state.revision,
  ]);
  let after: { at: number; id: string; filter: string } | undefined;
  if (input.cursor) {
    try {
      after = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
    } catch {
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Invalid asset cursor'
      );
    }
    if (
      after?.filter !== filter ||
      !Number.isFinite(after.at) ||
      typeof after.id !== 'string'
    )
      throw new BeatDesignCommandError(
        'REVISION_CONFLICT',
        'Asset query changed; restart pagination'
      );
  }
  const db = await getDb();
  const locations = state.document.assetLocations;
  const assigned = Object.keys(locations);
  const folderAssets = assigned.filter((id) => locations[id] === folderId);
  const limit = Math.max(1, Math.min(500, Math.floor(input.limit ?? 100)));
  const rows = await db
    .select()
    .from(userAsset)
    .where(
      and(
        exists(
          db
            .select({ id: projectAssetMembership.id })
            .from(projectAssetMembership)
            .where(
              and(
                eq(projectAssetMembership.projectId, projectId),
                eq(projectAssetMembership.assetId, userAsset.id)
              )
            )
        ),
        scope === 'current'
          ? folderId
            ? folderAssets.length
              ? inArray(userAsset.id, folderAssets)
              : sql`0`
            : assigned.length
              ? notInArray(userAsset.id, assigned)
              : undefined
          : undefined,
        input.query
          ? sql`instr(lower(coalesce(${userAsset.filename}, '')), ${input.query.toLowerCase()}) > 0`
          : undefined,
        after
          ? or(
              gt(userAsset.createdAt, new Date(after.at)),
              and(
                eq(userAsset.createdAt, new Date(after.at)),
                gt(userAsset.id, after.id)
              )
            )
          : undefined
      )
    )
    .orderBy(asc(userAsset.createdAt), asc(userAsset.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    assets: page.map((asset: any) => ({
      ...asset,
      folderId: locations[asset.id] ?? null,
    })),
    organizationRevision: state.revision,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({
              at: new Date(last.createdAt).getTime(),
              id: last.id,
              filter,
            })
          ).toString('base64url')
        : null,
  };
}

export async function organizationConsumers(
  projectId: string,
  supplied?: ProjectSnapshotDocument
) {
  const canvas =
    supplied ?? (await loadProjectWithLatestSnapshot({ projectId }))?.snapshot;
  return Object.values(canvas?.organization?.elementBindings ?? {}).map(
    (binding: any) => ({
      elementId: binding.elementId,
      consumerCardId: binding.consumerCardId,
      name:
        canvas?.cards.find((card) => card.id === binding.consumerCardId)
          ?.name ?? binding.consumerCardId,
    })
  );
}

export async function validateOrganizationBindings(
  projectId: string,
  canvas: ProjectSnapshotDocument
) {
  const bindings = Object.values(canvas.organization?.elementBindings ?? {});
  const slots = Object.values(
    canvas.organization?.templateInstances ?? {}
  ).flatMap((instance) => Object.values(instance.slotBindings));
  for (const slot of slots) {
    if (slot.elementId || slot.versionId) {
      const { document } = await getOrganization(projectId);
      const element = document.elements[slot.elementId ?? ''];
      if (
        !element ||
        element.deletedAt ||
        element.versions[slot.versionId ?? '']?.assetId !== slot.assetId
      )
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'Template Element version is unavailable'
        );
    }
    if (!(await getProjectAssetById({ projectId, assetId: slot.assetId })))
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Template slot Asset is not in the project'
      );
  }
  if (!bindings.length) return;
  const { document } = await getOrganization(projectId);
  const db = await getDb();
  for (const binding of bindings) {
    const element = document.elements[binding.elementId];
    const version = element?.versions[binding.versionId];
    if (!element || element.deletedAt || version?.assetId !== binding.assetId)
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Element binding changed or is unavailable'
      );
    const [member] = await db
      .select({ id: projectAssetMembership.id })
      .from(projectAssetMembership)
      .where(
        and(
          eq(projectAssetMembership.projectId, projectId),
          eq(projectAssetMembership.assetId, binding.assetId)
        )
      )
      .limit(1);
    if (!member)
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Bound Asset is not in the project'
      );
  }
}

// Resolve precise media on the server. The operation and the actual reference card
// are saved together, rather than persisting a symbolic input that cannot generate.
export async function prepareCanvasOrganizationOperations(
  projectId: string,
  canvas: ProjectSnapshotDocument,
  operations: CanvasOperation[]
): Promise<CanvasOperation[]> {
  const result: CanvasOperation[] = [];
  const state = await getOrganization(projectId);
  const mediaCard = async (cardId: string, assetId: string) => {
    const asset = await getProjectAssetById({ projectId, assetId });
    if (!asset || !['image', 'video', 'audio'].includes(asset.type))
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Reference requires a project media Asset'
      );
    const existing = canvas.cards.find((card) => card.id === cardId);
    if (existing && existing.assetId !== asset.id)
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Reference card ID already belongs to another Asset'
      );
    const base = buildTextCard({
      id: cardId,
      name: asset.filename ?? asset.id,
      textContent: '',
    });
    result.push({
      type: 'upsert_card',
      card: {
        ...base,
        kind: 'asset',
        type: asset.type as 'image' | 'video' | 'audio',
        assetId: asset.id,
        url: asset.publicUrl,
      },
      frame: canvas.frames[cardId] ?? { x: 0, y: 0, w: 360, h: 240 },
    });
  };
  for (const operation of operations) {
    if (operation.type === 'bind_element') {
      const element = state.document.elements[operation.elementId];
      if (
        !element ||
        element.deletedAt ||
        element.versions[operation.versionId]?.assetId !== operation.assetId
      )
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'Element version is unavailable'
        );
      await mediaCard(operation.referenceCardId, operation.assetId);
    }
    if (operation.type === 'review_element_binding') {
      const previous =
        canvas.organization?.elementBindings[operation.bindingId];
      const element = previous && state.document.elements[previous.elementId];
      if (
        !element ||
        element.currentVersionId !== operation.observedCurrentVersionId
      )
        throw new BeatDesignCommandError(
          'REVISION_CONFLICT',
          'Element current version changed; review again'
        );
      if (operation.decision === 'adopt' && operation.binding) {
        if (
          operation.binding.versionId !== element.currentVersionId ||
          element.versions[element.currentVersionId]?.assetId !==
            operation.binding.assetId
        )
          throw new BeatDesignCommandError(
            'INVALID_COMMAND',
            'Adoption must use the reviewed current version'
          );
        await mediaCard(
          operation.binding.referenceCardId,
          operation.binding.assetId
        );
      }
    }
    if (operation.type === 'bind_template_slot') {
      await mediaCard(
        operation.binding.referenceCardId,
        operation.binding.assetId
      );
    }
    result.push(operation);
  }
  return result;
}

export async function saveOrganizationOperations(
  projectId: string,
  operations: OrganizationOperation[],
  expectedRevision: number
) {
  const state = await getOrganization(projectId);
  if (state.revision !== expectedRevision)
    throw Object.assign(
      new BeatDesignCommandError(
        'REVISION_CONFLICT',
        'Organization changed; reload before applying'
      ),
      { currentVersion: state.revision }
    );
  const db = await getDb();
  const rows = await db
    .select({ id: userAsset.id, type: userAsset.type })
    .from(userAsset)
    .where(
      exists(
        db
          .select({ id: projectAssetMembership.id })
          .from(projectAssetMembership)
          .where(
            and(
              eq(projectAssetMembership.projectId, projectId),
              eq(projectAssetMembership.assetId, userAsset.id)
            )
          )
      )
    );
  const result = applyOrganizationOperations(state.document, operations, {
    assets: new Map(rows.map((a: any) => [a.id, { type: a.type }])),
    consumers: await organizationConsumers(projectId),
    revision: state.revision,
  });
  const revision = state.revision + 1;
  if (!state.revision)
    await db
      .insert(projectOrganizationState)
      .values({ projectId, documentJson: result.document, version: revision });
  else {
    const updated = await db
      .update(projectOrganizationState)
      .set({
        documentJson: result.document,
        version: revision,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectOrganizationState.projectId, projectId),
          eq(projectOrganizationState.version, state.revision)
        )
      )
      .returning({ version: projectOrganizationState.version });
    if (!updated.length)
      throw new BeatDesignCommandError(
        'REVISION_CONFLICT',
        'Organization changed'
      );
  }
  return { ...result, revision };
}

export async function organizationPreview(
  projectId: string,
  folderId?: string,
  elementId?: string
) {
  const state = await getOrganization(projectId);
  if (folderId)
    return previewFolderRemoval(state.document, folderId, state.revision);
  return {
    organizationRevision: state.revision,
    consumers: (await organizationConsumers(projectId)).filter(
      (c) => c.elementId === elementId
    ),
  };
}
