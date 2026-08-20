export const recentAssetsKeys = {
  all: ['recent-assets'] as const,
  lists: (projectId?: string | null) =>
    [...recentAssetsKeys.all, 'list', projectId ?? 'all'] as const,
};

export const workspaceProjectsKeys = {
  all: ['workspace-projects'] as const,
  list: (locale: string) =>
    [...workspaceProjectsKeys.all, 'list', locale] as const,
};

export const workspaceModelsKeys = {
  all: ['workspace-models'] as const,
  list: (type: 'ai-image' | 'ai-video' | 'all') =>
    [...workspaceModelsKeys.all, 'list', type] as const,
};

export const effectMetadataKeys = {
  all: ['effect-metadata'] as const,
  byIds: (ids: readonly number[]) =>
    [
      ...effectMetadataKeys.all,
      'ids',
      [...ids].sort((a, b) => a - b).join(','),
    ] as const,
};

export const generationStatusKeys = {
  all: ['generation-status'] as const,
  byTask: (wmTaskId: string, effectId: number) =>
    [...generationStatusKeys.all, wmTaskId, effectId] as const,
};
