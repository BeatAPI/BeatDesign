'use client';

import {
  WorkspaceProjectHub,
  type WorkspaceProjectCardItem,
} from '@/components/app/workspace-project-hub';
import { useWorkspaceProjects } from '@/core/workspace-hooks/use-workspace-projects';

export function WorkspaceClientWrapper({
  locale,
  projects,
  createProjectHref,
  createProjectLoginHref,
  isAuthenticated,
}: {
  locale: string;
  projects: WorkspaceProjectCardItem[];
  createProjectHref: string;
  createProjectLoginHref?: string;
  isAuthenticated?: boolean;
}) {
  const { projects: queryProjects, deleteProjects } = useWorkspaceProjects({
    locale,
    initialProjects: projects,
    enabled: Boolean(isAuthenticated),
  });

  return (
    <WorkspaceProjectHub
      locale={locale}
      projects={queryProjects}
      createProjectHref={createProjectHref}
      createProjectLoginHref={createProjectLoginHref}
      isAuthenticated={isAuthenticated}
      onDeleteProjects={deleteProjects}
    />
  );
}
