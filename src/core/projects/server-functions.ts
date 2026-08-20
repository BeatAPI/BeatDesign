import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const loadProjectsSchema = z.object({
  limit: z.number().int().positive().optional(),
});

const loadProjectWithLatestSnapshotSchema = z.object({
  projectId: z.string().min(1),
});

export const loadSerializedProjectsFn = createServerFn()
  .inputValidator(loadProjectsSchema)
  .handler(async ({ data }) => {
    const [{ loadProjects }, { serializeProjectCenterCard }] =
      await Promise.all([
        import('./projects'),
        import('./project-entry'),
      ]);
    const projects = await loadProjects({ limit: data.limit });
    return projects.map(serializeProjectCenterCard);
  });

export const loadProjectWithLatestSnapshotFn = createServerFn()
  .inputValidator(loadProjectWithLatestSnapshotSchema)
  .handler(async ({ data }) => {
    const { loadProjectWithLatestSnapshot } = await import('./projects');
    return loadProjectWithLatestSnapshot({
      projectId: data.projectId,
    });
  });
