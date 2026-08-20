import {
  effectMetadataKeys,
  workspaceModelsKeys,
} from '@/core/workspace-lib/app/workspace-query-keys';
import type { EffectMetadata } from '@/core/effects/client-api';
import type {
  WorkspaceModelOption,
  WorkspaceType,
} from '@/core/effects/workspace-models';
import { apiJsonGet } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';

export type WorkspaceModelType = WorkspaceType;

export type WorkspaceModelMetadata = WorkspaceModelOption & {
  workspaceType: WorkspaceType;
  inputSchema: unknown;
  defaultProviderModelVariant: string | null;
};

export function useWorkspaceModels(type?: WorkspaceModelType) {
  const resolvedType = type ?? 'all';

  return useQuery({
    queryKey: workspaceModelsKeys.list(resolvedType),
    queryFn: async () => {
      const query = type ? `?type=${encodeURIComponent(type)}` : '';
      return apiJsonGet<{ models: WorkspaceModelMetadata[] }>(
        `/api/app/effects/models${query}`
      );
    },
    staleTime: 10 * 60 * 1000,
  });
}

type EffectMetadataQueryOptions = {
  enabled?: boolean;
};

export function getEffectMetadataQueryState(
  ids: readonly number[],
  options?: EffectMetadataQueryOptions
) {
  const normalizedIds = [...new Set(ids)]
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);

  return {
    normalizedIds,
    enabled: normalizedIds.length > 0 && options?.enabled !== false,
  };
}

export function useEffectMetadata(
  ids: readonly number[],
  options?: EffectMetadataQueryOptions
) {
  const { normalizedIds, enabled } = getEffectMetadataQueryState(ids, options);

  return useQuery({
    queryKey: effectMetadataKeys.byIds(normalizedIds),
    queryFn: async () => {
      return apiJsonGet<{ effects: Record<string, EffectMetadata> }>(
        `/api/effects/metadata?ids=${normalizedIds.join(',')}`
      );
    },
    enabled,
    placeholderData: { effects: {} },
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });
}
