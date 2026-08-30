import { createFileRoute } from '@tanstack/react-router';

import { WorkspaceProjectRoutePage } from '@/components/app/workspace-project-route-page';
import { loadWorkspaceProjectRoute } from '@/core/projects/workspace-project-route-loader';

export const Route = createFileRoute('/editor/$projectId')({
  ssr: 'data-only',
  loader: ({ params }) =>
    loadWorkspaceProjectRoute({
      projectId: params.projectId,
      search: {},
      workspaceMode: 'editor',
    }),
  component: EditorProjectRouteComponent,
});

function EditorProjectRouteComponent() {
  return <WorkspaceProjectRoutePage data={Route.useLoaderData()} />;
}
