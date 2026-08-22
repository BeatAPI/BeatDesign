import { createFileRoute } from '@tanstack/react-router';

import { listProjectGenerations } from '@/core/effects/project-generations';
import { getProject } from '@/core/projects/projects';

async function GET({ params }: { params: { projectId: string } }) {
  const project = await getProject({ projectId: params.projectId });
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const items = await listProjectGenerations(params.projectId);
  return Response.json({ items });
}

export const Route = createFileRoute('/api/app/projects/$projectId/generations')(
  {
    server: { handlers: { GET } },
  }
);
