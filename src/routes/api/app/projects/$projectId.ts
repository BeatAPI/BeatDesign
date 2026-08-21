import { createFileRoute } from '@tanstack/react-router';
import {
  resolveWorkspaceMode,
  type WorkspaceMode,
} from '@/config/workspace-modes';
import {
  getProject,
  markProjectOpened,
  renameProject,
} from '@/core/projects/projects';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

type UpdateProjectRequest = {
  name?: string;
  workspaceMode?: string;
};

type OpenProjectRequest = {
  workspaceMode?: string;
};

async function POST({
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
  let payload: OpenProjectRequest = {};
  try {
    payload = await readRequestJsonWithLimit<OpenProjectRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const workspaceMode: WorkspaceMode | undefined = payload.workspaceMode
    ? resolveWorkspaceMode(payload.workspaceMode)
    : undefined;
  const currentProject = await getProject({ projectId });

  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  await markProjectOpened({
    projectId,
    workspaceMode,
  });

  return Response.json({
    id: projectId,
    lastOpenedAt: new Date().toISOString(),
    workspaceMode,
  });
}

async function PATCH({
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

  let payload: UpdateProjectRequest | null = null;
  try {
    payload = await readRequestJsonWithLimit<UpdateProjectRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const nextName = payload?.name?.trim();
  if (!nextName) {
    return Response.json(
      { error: 'Project name is required' },
      { status: 400 }
    );
  }

  const name = await renameProject({
    projectId,
    name: nextName,
  });

  return Response.json({ id: projectId, name });
}

export const Route = createFileRoute('/api/app/projects/$projectId')({
  server: {
    handlers: { POST, PATCH },
  },
});
