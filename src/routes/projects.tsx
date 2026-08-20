import { createFileRoute, redirect } from '@tanstack/react-router';

import { WorkspacePage } from '@/components/home/workspace-page';
import {
  buildLocalizedCreateProjectPath,
  parseProjectEntryIntent,
} from '@/core/projects/project-entry';
import { loadSerializedProjectsFn } from '@/core/projects/server-functions';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';

export const Route = createFileRoute('/projects')({
  validateSearch: (search: Record<string, unknown>) => ({
    target: (search.target as string) || undefined,
    model: (search.model as string) || undefined,
    prompt: (search.prompt as string) || undefined,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const locale = getLocale();
    const { target, model, prompt } = parseProjectEntryIntent(deps.search);

    if (target || model || prompt) {
      throw redirect({
        to: buildLocalizedCreateProjectPath({
          locale,
          target,
          model,
          prompt,
          mode: 'canvas',
        }) as never,
      });
    }

    const projects = await loadSerializedProjectsFn({ data: {} });

    return {
      locale,
      projects,
    };
  },
  component: ProjectsRouteComponent,
});

function ProjectsRouteComponent() {
  const { locale, projects } = Route.useLoaderData();

  return (
    <WorkspacePage
      locale={locale}
      projects={projects}
    />
  );
}
