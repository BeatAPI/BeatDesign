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
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

type SaveProjectSnapshotRequest = {
  document?: ProjectSnapshotDocument;
  baseVersion?: number | null;
  allowEmpty?: boolean;
};

async function PUT({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  const { projectId } = params;
  const currentProject = await getProject({ projectId });
  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let payload: SaveProjectSnapshotRequest | null = null;
  try {
    const body = await readRequestTextWithLimit(
      request,
      MAX_PROJECT_SNAPSHOT_BYTES
    );
    payload = JSON.parse(body) as SaveProjectSnapshotRequest;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { error: 'Project snapshot is too large' },
        { status: 413 }
      );
    }
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
      allowEmpty: payload.allowEmpty === true,
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
      error.name === 'ProjectSnapshotDestructiveEmptyRejected'
    ) {
      return Response.json(
        {
          error: 'Unconfirmed empty project snapshot rejected',
          detail,
        },
        { status: 422 }
      );
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
