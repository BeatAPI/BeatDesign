import { eq } from 'drizzle-orm';
import { project, projectCanvasState, projectTimelineState } from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';

export async function loadProjectRevision(projectId: string) {
  const db = await getDb();
  const [row] = await db.select({
    status: project.status,
    canvas: projectCanvasState.version,
    timeline: projectTimelineState.version,
  }).from(project)
    .leftJoin(projectCanvasState, eq(projectCanvasState.projectId, project.id))
    .leftJoin(projectTimelineState, eq(projectTimelineState.projectId, project.id))
    .where(eq(project.id, projectId)).limit(1);
  return row?.status === 'active' ? { canvas: row.canvas ?? 1, timeline: row.timeline } : null;
}
