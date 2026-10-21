import { apiJsonGet, apiJsonPatch } from '@/lib/api-client';
import type { BeatDesignCommandResult } from '@/core/commands/contracts';
import type {
  ProjectSettings,
  ProjectSettingsPatch,
} from '@/core/projects/project-settings-contract';

export async function fetchProjectSettings(projectId: string) {
  return (
    await apiJsonGet<{ settings: ProjectSettings }>(
      `/api/app/projects/${encodeURIComponent(projectId)}`,
    )
  ).settings;
}

export async function saveProjectSettings(
  projectId: string,
  expectedRevision: number,
  patch: ProjectSettingsPatch,
) {
  const result = await apiJsonPatch<
    BeatDesignCommandResult<{ projectSettings: ProjectSettings }>
  >(`/api/app/projects/${encodeURIComponent(projectId)}`, {
    expectedRevision,
    patch,
    commandId: crypto.randomUUID(),
  });
  if (!result.ok) throw new Error(result.message);
  return result.data.projectSettings;
}
