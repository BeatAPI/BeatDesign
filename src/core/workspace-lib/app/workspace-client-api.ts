import type { WorkspaceProjectCardItem } from '@/components/app/workspace-project-hub';
import type { ProjectGenerationItem } from '@/core/effects/project-generations';
import { apiJsonDelete, apiJsonGet } from '@/lib/api-client';

export type RecentAsset = {
  id: string;
  publicUrl: string;
  filename?: string | null;
  width: number | null;
  height: number | null;
  durationMs?: number | null;
  createdAt: string | Date;
};

export type RecentAssetsResponse = {
  images: RecentAsset[];
  videos: RecentAsset[];
};

export async function fetchRecentAssets(
  projectId?: string | null
): Promise<RecentAssetsResponse> {
  const query = projectId
    ? `?projectId=${encodeURIComponent(projectId)}`
    : '';
  return apiJsonGet<RecentAssetsResponse>(`/api/app/recent-assets${query}`);
}

export async function fetchWorkspaceProjects(): Promise<{
  projects: WorkspaceProjectCardItem[];
}> {
  return apiJsonGet<{ projects: WorkspaceProjectCardItem[] }>(
    '/api/app/projects'
  );
}

export async function deleteWorkspaceProjects(projectIds: string[]) {
  return apiJsonDelete<{ success: true }>('/api/app/projects', { projectIds });
}

export async function fetchProjectGenerations(projectId: string) {
  return apiJsonGet<{ items: ProjectGenerationItem[] }>(
    `/api/app/projects/${encodeURIComponent(projectId)}/generations`
  );
}
