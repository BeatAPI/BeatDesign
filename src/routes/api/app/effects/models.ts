import { createFileRoute } from '@tanstack/react-router';
import { resolveWorkspaceEffectProviderModelVariant } from '@/core/effects/effect-registry';
import { getRegisteredEffectById } from '@/core/effects/registered-effects';
import {
  type WorkspaceType,
  getWorkspaceModelsByType,
} from '@/core/effects/workspace-models';

const isWorkspaceType = (value: string | null): value is WorkspaceType =>
  value === 'ai-image' || value === 'ai-video';

async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get('type');
  const types = isWorkspaceType(requestedType)
    ? [requestedType]
    : (['ai-image', 'ai-video'] as const);

  const registryModels = types.flatMap((type) =>
    getWorkspaceModelsByType(type).map((model) => ({
      ...model,
      workspaceType: type,
    }))
  );
  const models = registryModels.map((model) => {
    const effect = getRegisteredEffectById(model.effectId);

    return {
      ...model,
      inputSchema: effect?.inputSchema ?? null,
      defaultProviderModelVariant: model.defaultVariant
        ? resolveWorkspaceEffectProviderModelVariant({
            modelId: model.id,
            variant: model.defaultVariant,
          })
        : null,
      available: true,
    };
  });

  return Response.json({ models });
}

export const Route = createFileRoute('/api/app/effects/models')({
  server: {
    handlers: { GET },
  },
});
