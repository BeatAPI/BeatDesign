import { ProductPageShell } from '@/components/app/product-page-shell';
import { BeatStudioWorkspace } from '@/components/studio/beat-studio-workspace';
import { BeatCanvasShell } from '@/components/beatcanvas/beatcanvas-shell';
import type { loadWorkspaceProjectRoute } from '@/core/projects/workspace-project-route-loader';

type WorkspaceProjectRouteData = Awaited<
  ReturnType<typeof loadWorkspaceProjectRoute>
>;

export function WorkspaceProjectRoutePage({
  data,
}: {
  data: WorkspaceProjectRouteData;
}) {
  return (
    <ProductPageShell
      workspaceName={data.project.name}
      projectId={data.project.id}
      workspaceMode={data.workspaceMode}
    >
      {data.workspaceMode === 'studio' ? (
        <BeatStudioWorkspace
          projectId={data.project.id}
          initialTarget={data.target}
          initialModelId={data.modelId}
          initialPrompt={data.prompt}
        />
      ) : (
        <BeatCanvasShell
          projectId={data.project.id}
          projectPath={data.projectPath}
          initialProjectSnapshot={data.snapshot}
          initialProjectSnapshotVersion={data.snapshotVersion}
          initialTarget={data.target}
          initialModelId={data.modelId}
          initialPrompt={data.prompt}
        />
      )}
    </ProductPageShell>
  );
}
