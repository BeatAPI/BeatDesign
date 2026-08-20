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
  const { projectId } = params;
  let payload: OpenProjectRequest = {};
  try {
    payload = (await request.json()) as OpenProjectRequest;
  } catch {
    payload = {};
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
  const { projectId } = params;
  const currentProject = await getProject({ projectId });

  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let payload: UpdateProjectRequest | null = null;
  try {
    payload = (await request.json()) as UpdateProjectRequest;
  } catch {
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
