import { createFileRoute } from '@tanstack/react-router';
import {
  MAX_PROJECT_SNAPSHOT_BYTES,
  ProjectSnapshotValidationError,
  type ProjectSnapshotDocument,
  normalizeProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import {
  getProject,
  saveProjectSnapshot,
} from '@/core/projects/projects';

type SaveProjectSnapshotRequest = {
  document?: ProjectSnapshotDocument;
  baseVersion?: number | null;
};

async function PUT({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const { projectId } = params;
  const currentProject = await getProject({ projectId });
  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let payload: SaveProjectSnapshotRequest | null = null;
  try {
    const declaredLength = Number(request.headers.get('content-length'));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_PROJECT_SNAPSHOT_BYTES
    ) {
      return Response.json({ error: 'Project snapshot is too large' }, { status: 413 });
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_PROJECT_SNAPSHOT_BYTES) {
      return Response.json({ error: 'Project snapshot is too large' }, { status: 413 });
    }
    payload = JSON.parse(body) as SaveProjectSnapshotRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload?.document) {
    return Response.json(
      { error: 'Snapshot document is required' },
      { status: 400 }
    );
  }

  try {
    const result = await saveProjectSnapshot({
      projectId,
      document: normalizeProjectSnapshotDocument(payload.document),
      baseVersion:
        typeof payload.baseVersion === 'number' ? payload.baseVersion : null,
    });

    return Response.json({
      projectId,
      version: result.version,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Unknown save failure';

    if (error instanceof ProjectSnapshotValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.name === 'ProjectSnapshotVersionConflict'
    ) {
      const snapshotConflict = error as Error & {
        currentVersion?: unknown;
      };
      const currentVersion =
        typeof snapshotConflict.currentVersion === 'number'
          ? snapshotConflict.currentVersion
          : undefined;

      return Response.json(
        {
          error: 'Project snapshot version conflict',
          detail,
          currentVersion,
        },
        { status: 409 }
      );
    }

    console.error('save project snapshot failed:', {
      projectId,
      detail,
    });

    return Response.json(
      {
        error: 'Failed to save project snapshot',
        detail: process.env.NODE_ENV === 'development' ? detail : undefined,
      },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute('/api/app/projects/$projectId/snapshot')({
  server: {
    handlers: { PUT },
  },
});
