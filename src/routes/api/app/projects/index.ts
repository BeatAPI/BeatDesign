import { createFileRoute } from '@tanstack/react-router';
import { serializeProjectCenterCard } from '@/core/projects/project-entry';
import {
  createProject,
  deleteProjects,
  loadProjects,
} from '@/core/projects/projects';
import { resolveWorkspaceMode } from '@/config/workspace-modes';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

type DeleteProjectsRequest = {
  projectIds?: unknown;
};

type CreateProjectRequest = {
  name?: unknown;
  workspaceMode?: unknown;
};

const readProjectIds = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

async function GET() {
  const projects = await loadProjects({});
  return Response.json({ projects: projects.map(serializeProjectCenterCard) });
}

async function POST({ request }: { request: Request }) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  let payload: CreateProjectRequest | null = null;
  try {
    payload = await readRequestJsonWithLimit<CreateProjectRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name =
    typeof payload?.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : null;

  const nextProject = await createProject({
    name,
    workspaceMode: resolveWorkspaceMode(
      typeof payload?.workspaceMode === 'string' ? payload.workspaceMode : undefined
    ),
  });
  return Response.json({ id: nextProject.id, name: nextProject.name });
}

async function DELETE({ request }: { request: Request }) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  let payload: DeleteProjectsRequest | null = null;
  try {
    payload = await readRequestJsonWithLimit<DeleteProjectsRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const projectIds = readProjectIds(payload?.projectIds);
  if (projectIds.length === 0) {
    return Response.json(
      { error: 'projectIds is required' },
      { status: 400 }
    );
  }

  await deleteProjects({ projectIds });
  return Response.json({ success: true });
}

export const Route = createFileRoute('/api/app/projects/')({
  server: {
    handlers: { GET, POST, DELETE },
  },
});
