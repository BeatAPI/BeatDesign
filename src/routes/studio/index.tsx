import { createFileRoute } from '@tanstack/react-router';

import { CreateProjectRoutePage } from '@/components/app/create-project-route-page';
import { loadCreateProjectRoute } from '@/core/projects/create-project-route-loader';

const validateProjectIntent = (search: Record<string, unknown>) => ({
  target: (search.target as string) || undefined,
  model: (search.model as string) || undefined,
  prompt: (search.prompt as string) || undefined,
});

export const Route = createFileRoute('/studio/')({
  validateSearch: validateProjectIntent,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => loadCreateProjectRoute(deps.search, 'studio'),
  component: StudioRouteComponent,
});

function StudioRouteComponent() {
  return <CreateProjectRoutePage data={Route.useLoaderData()} />;
}
