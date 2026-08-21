
import { randomUUID } from 'crypto';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { project, projectCanvasState, userAsset } from '@/config/db/schema';
import {
  type ProjectSnapshotDocument,
  createEmptyProjectSnapshot,
  isDestructiveEmptyProjectSnapshot,
  normalizeProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import {
  defaultWorkspaceMode,
  resolveWorkspaceMode,
  type WorkspaceMode,
} from '@/config/workspace-modes';

const DEFAULT_PROJECT_NAME = 'Untitled project';

const trimProjectName = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_PROJECT_NAME;
};

export const createProject = async ({
  name,
  initialSnapshot,
  workspaceMode = defaultWorkspaceMode,
}: {
  name?: string | null;
  initialSnapshot?: ProjectSnapshotDocument;
  workspaceMode?: WorkspaceMode;
}) => {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date();
  const document = initialSnapshot ?? createEmptyProjectSnapshot();

  await db.insert(project).values({
    id,
    name: trimProjectName(name),
    coverAssetId: null,
    status: 'active',
    currentStateVersion: 1,
    lastWorkspaceMode: resolveWorkspaceMode(workspaceMode),
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(projectCanvasState).values({
    projectId: id,
    documentJson: document,
    version: 1,
    updatedAt: now,
  });

  return {
    id,
    name: trimProjectName(name),
    snapshot: document,
  };
};

export const loadProjects = async ({
  limit = 24,
}: {
  limit?: number;
}) => {
  const db = await getDb();
  const projects = await db
    .select({
      ...getTableColumns(project),
      coverImageUrl: userAsset.publicUrl,
    })
    .from(project)
    .leftJoin(userAsset, eq(project.coverAssetId, userAsset.id))
    .where(eq(project.status, 'active'))
    .orderBy(
      desc(project.lastOpenedAt),
      desc(project.updatedAt),
      desc(project.createdAt)
    )
    .limit(limit);

  return projects.map((entry: any) => ({
    ...entry,
    coverImageUrl: entry.coverImageUrl?.trim() || null,
  }));
};

export const getProject = async ({
  projectId,
}: {
  projectId: string;
}) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  return rows[0] ?? null;
};

export const renameProject = async ({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) => {
  const nextName = trimProjectName(name);
  const db = await getDb();
  await db
    .update(project)
    .set({
      name: nextName,
      updatedAt: new Date(),
    })
    .where(eq(project.id, projectId));

  return nextName;
};

export const markProjectOpened = async ({
  projectId,
  workspaceMode,
}: {
  projectId: string;
  workspaceMode?: WorkspaceMode;
}) => {
  const db = await getDb();
  const now = new Date();
  await db
    .update(project)
    .set({
      lastOpenedAt: now,
      ...(workspaceMode
        ? { lastWorkspaceMode: resolveWorkspaceMode(workspaceMode) }
        : {}),
    })
    .where(eq(project.id, projectId));
};

export const loadProjectWithLatestSnapshot = async ({
  projectId,
}: {
  projectId: string;
}) => {
  const db = await getDb();
  const currentProject = await getProject({ projectId });
  if (!currentProject) {
    return null;
  }

  const snapshotRows = await db
    .select()
    .from(projectCanvasState)
    .where(eq(projectCanvasState.projectId, projectId))
    .limit(1);

  return {
    project: currentProject,
    snapshotVersion: snapshotRows[0]?.version ?? 1,
    snapshot: normalizeProjectSnapshotDocument(
      snapshotRows[0]?.documentJson ?? createEmptyProjectSnapshot()
    ),
  };
};

export const deleteProjects = async ({
  projectIds,
}: {
  projectIds: string[];
}) => {
  if (projectIds.length === 0) return;

  const db = await getDb();
  const now = new Date();

  for (const projectId of projectIds) {
    await db
      .update(project)
      .set({
        status: 'deleted',
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(project.id, projectId));
  }
};

export const saveProjectSnapshot = async ({
  projectId,
  document,
  baseVersion,
  allowEmpty = false,
}: {
  projectId: string;
  document: ProjectSnapshotDocument;
  baseVersion?: number | null;
  allowEmpty?: boolean;
}) => {
  const db = await getDb();
  const currentProject = await getProject({ projectId });
  if (!currentProject) {
    throw new Error('Project not found');
  }

  const normalizedDocument = normalizeProjectSnapshotDocument(document);
  const stateRows = await db
    .select()
    .from(projectCanvasState)
    .where(eq(projectCanvasState.projectId, projectId))
    .limit(1);

  const currentState = stateRows[0] ?? null;
  const previousDocument = currentState
    ? normalizeProjectSnapshotDocument(currentState.documentJson)
    : null;
  if (
    previousDocument &&
    isDestructiveEmptyProjectSnapshot({
      previous: previousDocument,
      next: normalizedDocument,
    }) &&
    !allowEmpty
  ) {
    const error = new Error(
      'Refusing to replace a non-empty project snapshot with an unconfirmed empty snapshot'
    );
    error.name = 'ProjectSnapshotDestructiveEmptyRejected';
    throw error;
  }
  const nextSerialized = JSON.stringify(normalizedDocument);
  const previousSerialized = previousDocument
    ? JSON.stringify(previousDocument)
    : null;

  if (
    typeof baseVersion === 'number' &&
    currentState &&
    currentState.version !== baseVersion &&
    previousSerialized !== nextSerialized
  ) {
    const error = new Error('Project snapshot version conflict') as Error & {
      currentVersion?: number;
    };
    error.name = 'ProjectSnapshotVersionConflict';
    error.currentVersion = currentState.version;
    throw error;
  }
  const nextVersion = (currentState?.version ?? 0) + 1;
  const now = new Date();

  if (previousSerialized !== nextSerialized) {
    await db
      .insert(projectCanvasState)
      .values({
        projectId,
        documentJson: normalizedDocument,
        version: nextVersion,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: projectCanvasState.projectId,
        set: {
          documentJson: normalizedDocument,
          version: nextVersion,
          updatedAt: now,
        },
      });

    await db
      .update(project)
      .set({
        currentStateVersion: nextVersion,
        updatedAt: now,
        lastOpenedAt: now,
      })
      .where(eq(project.id, projectId));
  } else {
    await db
      .update(project)
      .set({
        lastOpenedAt: now,
      })
      .where(eq(project.id, projectId));
  }

  return {
    version:
      previousSerialized === nextSerialized
        ? (currentState?.version ?? 1)
        : nextVersion,
  };
};
