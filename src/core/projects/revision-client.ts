import { apiJsonGet } from '@/lib/api-client';

export async function hasNewProjectRevision(
  projectId: string,
  surface: 'canvas' | 'timeline',
  version: number | null
) {
  const revision = await apiJsonGet<{ canvas: number; timeline: number | null }>(
    `/api/app/projects/${encodeURIComponent(projectId)}/revision`
  );
  return revision[surface] !== null && (version === null || revision[surface]! > version);
}
