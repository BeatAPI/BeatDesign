import { createFileRoute } from '@tanstack/react-router';
import { getActiveProject } from '@/core/projects/projects';
import { loadProjectTimeline } from '@/core/editor/timeline-state';
import { getTimelineUsage } from '@/core/editor/timeline-usage';

async function GET({ params }: { params: { projectId: string } }) {
  try {
    if (!(await getActiveProject({ projectId: params.projectId })))
      return Response.json({ error: 'Project not found' }, { status: 404 });
    const timeline = await loadProjectTimeline(params.projectId);
    return Response.json(
      getTimelineUsage(timeline?.document ?? null, timeline?.version ?? null),
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch {
    return Response.json(
      { error: 'Unable to read Timeline usage' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/timeline-usage'
)({ server: { handlers: { GET } } });
