import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from '@/lib/trusted-local-request';

export type PersistedLocalProjectAsset = {
  id: string;
  type: 'image' | 'video' | 'audio';
  publicUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

export const uploadLocalProjectAsset = async ({
  projectId,
  file,
  assetClass = 'original',
  metadata,
  width,
  height,
  durationMs,
  fetchImpl = fetch,
}: {
  projectId: string;
  file: File;
  assetClass?: 'original' | 'derived';
  metadata?: Record<string, unknown>;
  width?: number;
  height?: number;
  durationMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<PersistedLocalProjectAsset> => {
  const formData = new FormData();
  formData.set('file', file, file.name);
  formData.set('assetClass', assetClass);
  if (metadata) formData.set('metadata', JSON.stringify(metadata));
  if (Number.isFinite(width)) formData.set('width', String(width));
  if (Number.isFinite(height)) formData.set('height', String(height));
  if (Number.isFinite(durationMs)) formData.set('durationMs', String(durationMs));
  const response = await fetchImpl(
    `/api/app/projects/${encodeURIComponent(projectId)}/assets`,
    {
      method: 'POST',
      headers: {
        [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
      },
      body: formData,
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | { asset?: PersistedLocalProjectAsset; error?: string }
    | null;
  if (!response.ok || !payload?.asset) {
    throw new Error(payload?.error || 'Failed to save project asset locally');
  }
  return payload.asset;
};
