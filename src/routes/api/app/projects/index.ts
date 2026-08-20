import { createFileRoute } from '@tanstack/react-router';
import { serializeProjectCenterCard } from '@/core/projects/project-entry';
import {
  createProject,
  deleteProjects,
  loadProjects,
} from '@/core/projects/projects';
import { resolveWorkspaceMode } from '@/config/workspace-modes';

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
  let payload: CreateProjectRequest | null = null;
  try {
    payload = (await request.json()) as CreateProjectRequest;
  } catch {
    payload = {};
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
  let payload: DeleteProjectsRequest | null = null;
  try {
    payload = (await request.json()) as DeleteProjectsRequest;
  } catch {
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
