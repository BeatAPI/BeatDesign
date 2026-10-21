import { z } from 'zod';

export const MAX_ORGANIZATION_BYTES = 2 * 1024 * 1024;
const id = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (value) =>
      value.trim() === value &&
      !['__proto__', 'constructor', 'prototype'].includes(value),
    'Invalid or reserved identifier'
  );
const name = z
  .string()
  .transform((value) => value.trim().normalize('NFC'))
  .pipe(z.string().min(1).max(200));
const description = z.string().max(2000);
const kind = z.enum(['character', 'scene', 'prop', 'voice']);
const timestamp = z.iso.datetime({ offset: true });
const folderSchema = z.object({ id, name, parentId: id.nullable() }).strict();
const elementVersionSchema = z
  .object({
    id,
    assetId: id,
    mediaType: z.enum(['image', 'audio']),
    createdAt: timestamp,
  })
  .strict();
const elementSchema = z
  .object({
    id,
    name,
    kind,
    description,
    currentVersionId: id,
    versions: z.record(id, elementVersionSchema),
    deletedAt: timestamp.nullable(),
  })
  .strict();
export const organizationDocumentSchema = z
  .object({
    version: z.literal(1),
    folders: z.record(id, folderSchema),
    assetLocations: z.record(id, id),
    elements: z.record(id, elementSchema),
  })
  .strict();
export type ProjectOrganizationDocument = z.infer<
  typeof organizationDocumentSchema
>;
export type ReusableElement = z.infer<typeof elementSchema>;
export type ElementVersion = z.infer<typeof elementVersionSchema>;
export type AssetFolder = z.infer<typeof folderSchema>;

export const organizationOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create_folder'),
      folderId: id,
      name,
      parentId: id.nullable(),
    })
    .strict(),
  z.object({ type: z.literal('rename_folder'), folderId: id, name }).strict(),
  z
    .object({
      type: z.literal('move_folder'),
      folderId: id,
      parentId: id.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('remove_folder'),
      folderId: id,
      previewRevision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal('assign_assets'),
      assetIds: z.array(id).min(1).max(10000),
      folderId: id.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('create_element'),
      elementId: id,
      name,
      kind,
      description,
      versionId: id,
      assetId: id,
    })
    .strict(),
  z
    .object({
      type: z.literal('update_element'),
      elementId: id,
      name: name.optional(),
      description: description.optional(),
    })
    .strict()
    .refine(
      (value) => value.name !== undefined || value.description !== undefined,
      'Empty Element update'
    ),
  z
    .object({
      type: z.literal('add_element_version'),
      elementId: id,
      versionId: id,
      assetId: id,
    })
    .strict(),
  z
    .object({
      type: z.literal('set_element_current'),
      elementId: id,
      versionId: id,
    })
    .strict(),
  z.object({ type: z.literal('remove_element'), elementId: id }).strict(),
  z.object({ type: z.literal('restore_element'), elementId: id }).strict(),
]);
export type OrganizationOperation = z.infer<typeof organizationOperationSchema>;

export class OrganizationValidationError extends Error {
  readonly code: 'INVALID_COMMAND' | 'REVISION_CONFLICT';
  readonly consumers?: string[];
  constructor(
    message: string,
    code: 'INVALID_COMMAND' | 'REVISION_CONFLICT' = 'INVALID_COMMAND',
    consumers?: string[]
  ) {
    super(message);
    this.name = 'OrganizationValidationError';
    this.code = code;
    this.consumers = consumers;
  }
}
const invalid = (message: string): never => {
  throw new OrganizationValidationError(message);
};
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const nameKey = (value: string) => value.normalize('NFC').toLowerCase();
const own = <T>(record: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

export function emptyOrganizationDocument(): ProjectOrganizationDocument {
  return { version: 1, folders: {}, assetLocations: {}, elements: {} };
}

function assertDocument(document: ProjectOrganizationDocument) {
  if (Object.keys(document.folders).length > 500)
    invalid('Folder limit exceeded (500).');
  if (Object.keys(document.assetLocations).length > 10000)
    invalid('Asset location limit exceeded (10000).');
  if (Object.keys(document.elements).length > 256)
    invalid('Element limit exceeded (256).');
  const siblings = new Set<string>();
  for (const [key, folder] of Object.entries(document.folders)) {
    if (key !== folder.id) invalid('Folder key does not match its stable ID.');
    const siblingKey = JSON.stringify([folder.parentId, nameKey(folder.name)]);
    if (siblings.has(siblingKey))
      invalid('Folder names must be unique within their parent.');
    siblings.add(siblingKey);
    const seen = new Set<string>([folder.id]);
    let parent = folder.parentId;
    let depth = 0;
    while (parent !== null) {
      if (seen.has(parent)) invalid('Folder cycle detected.');
      seen.add(parent);
      const ancestor = own(document.folders, parent);
      if (!ancestor) invalid(`Parent folder ${parent} does not exist.`);
      parent = ancestor!.parentId;
      if (++depth > 8) invalid('Folder depth exceeds eight levels.');
    }
  }
  for (const folderId of Object.values(document.assetLocations)) {
    if (!own(document.folders, folderId))
      invalid(`Folder ${folderId} does not exist.`);
  }
  for (const [key, element] of Object.entries(document.elements)) {
    if (key !== element.id)
      invalid('Element key does not match its stable ID.');
    const versions = Object.entries(element.versions);
    if (!versions.length || versions.length > 100)
      invalid('Elements require between one and 100 versions.');
    if (!own(element.versions, element.currentVersionId))
      invalid('Element current version does not exist.');
    for (const [versionId, version] of versions) {
      if (versionId !== version.id)
        invalid('Element version key does not match its stable ID.');
      if (version.mediaType !== (element.kind === 'voice' ? 'audio' : 'image'))
        invalid('Element media type does not match its kind.');
    }
  }
  if (
    new TextEncoder().encode(JSON.stringify(document)).byteLength >
    MAX_ORGANIZATION_BYTES
  )
    invalid('Organization document exceeds 2 MiB.');
}

export function normalizeOrganizationDocument(
  value: unknown
): ProjectOrganizationDocument {
  if (value === null || value === undefined) return emptyOrganizationDocument();
  const parsed = organizationDocumentSchema.safeParse(value);
  if (!parsed.success)
    invalid(
      parsed.error.issues[0]?.message ?? 'Invalid organization document.'
    );
  const document = parsed.data!;
  assertDocument(document);
  return document;
}

export function previewFolderRemoval(
  document: ProjectOrganizationDocument,
  folderId: string,
  revision = 0
) {
  const folder = own(document.folders, folderId);
  if (!folder) invalid(`Folder ${folderId} does not exist.`);
  const childFolders = Object.values(document.folders).filter(
    (candidate) => candidate.parentId === folderId
  );
  const destinationFolders = Object.values(document.folders).filter(
    (candidate) =>
      candidate.parentId === folder!.parentId && candidate.id !== folderId
  );
  const conflicts = childFolders.flatMap((child) =>
    destinationFolders
      .filter((candidate) => nameKey(candidate.name) === nameKey(child.name))
      .map((candidate) => ({
        folderId: child.id,
        conflictingFolderId: candidate.id,
        name: child.name,
      }))
  );
  return {
    organizationRevision: revision,
    folderId,
    parentId: folder!.parentId,
    assetIds: Object.keys(document.assetLocations)
      .filter((assetId) => document.assetLocations[assetId] === folderId)
      .sort(),
    childFolderIds: childFolders.map((child) => child.id).sort(),
    conflicts,
  };
}

export function applyOrganizationOperations(
  source: ProjectOrganizationDocument,
  input: OrganizationOperation[],
  options: {
    assets: Map<string, { type: string }>;
    consumers?: { elementId: string; consumerCardId: string }[];
    revision?: number;
    now?: string;
  }
): { document: ProjectOrganizationDocument; changedIds: string[] } {
  const document = normalizeOrganizationDocument(source);
  const parsed = z
    .array(organizationOperationSchema)
    .min(1)
    .max(500)
    .safeParse(input);
  if (!parsed.success)
    invalid(
      parsed.error.issues[0]?.message ?? 'Invalid organization operations.'
    );
  const now = timestamp.parse(options.now ?? new Date().toISOString());
  const changed = new Set<string>();
  const requireFolder = (folderId: string) =>
    own(document.folders, folderId) ??
    invalid(`Folder ${folderId} does not exist.`);
  const requireElement = (elementId: string, allowDeleted = false) => {
    const element =
      own(document.elements, elementId) ??
      invalid(`Element ${elementId} does not exist.`);
    if (element.deletedAt && !allowDeleted)
      invalid('Restore this Element before editing it.');
    return element;
  };
  const assetType = (assetId: string, expected?: string) => {
    const asset =
      options.assets.get(assetId) ??
      invalid(`Asset ${assetId} does not belong to this project.`);
    if (expected && asset.type !== expected)
      invalid(`Asset ${assetId} must be ${expected}.`);
    return asset.type;
  };
  for (const operation of parsed.data!) {
    switch (operation.type) {
      case 'create_folder': {
        const next = {
          id: operation.folderId,
          name: operation.name,
          parentId: operation.parentId,
        };
        const previous = own(document.folders, operation.folderId);
        if (previous && !equal(previous, next))
          invalid('Folder ID already belongs to different content.');
        if (!previous) {
          document.folders[operation.folderId] = next;
          changed.add(operation.folderId);
        }
        break;
      }
      case 'rename_folder': {
        const folder = requireFolder(operation.folderId);
        if (folder.name !== operation.name) {
          folder.name = operation.name;
          changed.add(folder.id);
        }
        break;
      }
      case 'move_folder': {
        const folder = requireFolder(operation.folderId);
        if (folder.parentId !== operation.parentId) {
          folder.parentId = operation.parentId;
          changed.add(folder.id);
        }
        break;
      }
      case 'remove_folder': {
        if (options.revision === undefined)
          invalid(
            'Folder removal requires the authoritative organization revision.'
          );
        if (operation.previewRevision !== options.revision)
          throw new OrganizationValidationError(
            'Folder preview is stale. Preview the removal again.',
            'REVISION_CONFLICT'
          );
        const preview = previewFolderRemoval(
          document,
          operation.folderId,
          options.revision
        );
        if (preview.conflicts.length)
          invalid(
            'Removing this folder would create duplicate child names. Rename them first.'
          );
        for (const assetId of preview.assetIds) {
          if (preview.parentId === null)
            delete document.assetLocations[assetId];
          else document.assetLocations[assetId] = preview.parentId;
          changed.add(assetId);
        }
        for (const folderId of preview.childFolderIds) {
          document.folders[folderId].parentId = preview.parentId;
          changed.add(folderId);
        }
        delete document.folders[operation.folderId];
        changed.add(operation.folderId);
        break;
      }
      case 'assign_assets': {
        for (const assetId of new Set(operation.assetIds)) {
          assetType(assetId);
          const previous = own(document.assetLocations, assetId) ?? null;
          if (previous === operation.folderId) continue;
          if (operation.folderId === null)
            delete document.assetLocations[assetId];
          else document.assetLocations[assetId] = operation.folderId;
          changed.add(assetId);
        }
        break;
      }
      case 'create_element': {
        const mediaType = operation.kind === 'voice' ? 'audio' : 'image';
        assetType(operation.assetId, mediaType);
        const existing = own(document.elements, operation.elementId);
        if (existing) {
          const first = own(existing.versions, operation.versionId);
          if (
            existing.deletedAt ||
            existing.name !== operation.name ||
            existing.kind !== operation.kind ||
            existing.description !== operation.description ||
            !first ||
            first.assetId !== operation.assetId ||
            first.mediaType !== mediaType
          )
            invalid('Element ID already belongs to different content.');
          break;
        }
        document.elements[operation.elementId] = {
          id: operation.elementId,
          name: operation.name,
          kind: operation.kind,
          description: operation.description,
          currentVersionId: operation.versionId,
          versions: {
            [operation.versionId]: {
              id: operation.versionId,
              assetId: operation.assetId,
              mediaType,
              createdAt: now,
            },
          },
          deletedAt: null,
        };
        changed.add(operation.elementId);
        break;
      }
      case 'update_element': {
        const element = requireElement(operation.elementId);
        if (operation.name !== undefined && element.name !== operation.name) {
          element.name = operation.name;
          changed.add(element.id);
        }
        if (
          operation.description !== undefined &&
          element.description !== operation.description
        ) {
          element.description = operation.description;
          changed.add(element.id);
        }
        break;
      }
      case 'add_element_version': {
        const element = requireElement(operation.elementId);
        const mediaType = element.kind === 'voice' ? 'audio' : 'image';
        assetType(operation.assetId, mediaType);
        const existing = own(element.versions, operation.versionId);
        if (
          existing &&
          (existing.assetId !== operation.assetId ||
            existing.mediaType !== mediaType)
        )
          invalid('Element versions are immutable; use a new version ID.');
        if (!existing) {
          element.versions[operation.versionId] = {
            id: operation.versionId,
            assetId: operation.assetId,
            mediaType,
            createdAt: now,
          };
          changed.add(element.id);
          changed.add(operation.versionId);
        }
        break;
      }
      case 'set_element_current': {
        const element = requireElement(operation.elementId);
        const version =
          own(element.versions, operation.versionId) ??
          invalid('Element version does not exist.');
        assetType(version.assetId, version.mediaType);
        if (element.currentVersionId !== operation.versionId) {
          element.currentVersionId = operation.versionId;
          changed.add(element.id);
        }
        break;
      }
      case 'remove_element': {
        const element = requireElement(operation.elementId, true);
        const consumers = [
          ...new Set(
            (options.consumers ?? [])
              .filter((consumer) => consumer.elementId === element.id)
              .map((consumer) => consumer.consumerCardId)
          ),
        ];
        if (consumers.length)
          throw new OrganizationValidationError(
            `Element is used by: ${consumers.join(', ')}. Unbind or replace it first.`,
            'INVALID_COMMAND',
            consumers
          );
        if (!element.deletedAt) {
          element.deletedAt = now;
          changed.add(element.id);
        }
        break;
      }
      case 'restore_element': {
        const element = requireElement(operation.elementId, true);
        if (element.deletedAt) {
          element.deletedAt = null;
          changed.add(element.id);
        }
        break;
      }
    }
  }
  // Validate the batch's final state, permitting atomic sibling renames and reparenting.
  return {
    document: normalizeOrganizationDocument(document),
    changedIds: [...changed],
  };
}
