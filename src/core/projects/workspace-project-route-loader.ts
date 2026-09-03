import { notFound } from '@tanstack/react-router';

import type { WorkspaceMode } from '@/config/workspace-modes';
import {
  buildLocalizedProjectDetailPath,
  parseProjectEntryIntent,
} from '@/core/projects/project-entry';
import { loadProjectWithLatestSnapshotFn } from '@/core/projects/server-functions';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';

export async function loadWorkspaceProjectRoute({
  projectId,
  search,
  workspaceMode,
}: {
  projectId: string;
  search: Record<string, string | undefined>;
  workspaceMode: WorkspaceMode;
}) {
  const locale = getLocale();
  const { target, model, prompt, focus } = parseProjectEntryIntent(search);

  const projectState = await loadProjectWithLatestSnapshotFn({
    data: { projectId },
  });

  if (!projectState) throw notFound();

  return {
    locale,
    project: projectState.project,
    snapshot: projectState.snapshot,
    snapshotVersion: projectState.snapshotVersion,
    target: target ?? null,
    modelId: model ?? null,
    prompt: prompt ?? null,
    focusCardId: focus ?? null,
    projectPath: buildLocalizedProjectDetailPath({
      locale,
      projectId: projectState.project.id,
      mode: workspaceMode,
    }),
    workspaceMode,
  };
}
