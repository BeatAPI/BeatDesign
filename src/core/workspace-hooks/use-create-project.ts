import { useEffect, useRef, useState } from 'react';

import type { WorkspaceMode } from '@/config/workspace-modes';
import {
  buildPostCreateProjectDetailPath,
  type ProjectEntryIntent,
} from '@/core/projects/project-entry';
import { createWorkspaceProject } from '@/core/workspace-lib/app/workspace-client-api';

export function useCreateProject({
  locale,
  projectName,
  errorMessage,
  replace = false,
  ...intent
}: ProjectEntryIntent & {
  locale: string;
  projectName: string;
  errorMessage: string;
  replace?: boolean;
}) {
  const inFlight = useRef(false);
  const lastMode = useRef<WorkspaceMode | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function createProject(workspaceMode: WorkspaceMode) {
    // State updates may not render before a second click arrives.
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    lastMode.current = workspaceMode;
    setCreating(true);
    setError(null);
    try {
      const payload = await createWorkspaceProject({
        name: projectName,
        workspaceMode,
      });
      if (!payload?.id) throw new Error(payload?.error || errorMessage);
      const path = buildPostCreateProjectDetailPath({
        locale,
        projectId: payload.id,
        ...intent,
        mode: workspaceMode,
      });
      if (replace) window.location.replace(path);
      else window.location.assign(path);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : errorMessage
      );
      inFlight.current = false;
      setCreating(false);
    }
  }

  return {
    ready,
    creating,
    error,
    createProject,
    clearError: () => setError(null),
    retryProject: () =>
      lastMode.current ? createProject(lastMode.current) : Promise.resolve(),
  };
}
