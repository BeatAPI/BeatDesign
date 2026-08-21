import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from '@/lib/trusted-local-request';

export type PersistedLocalProjectAsset = {
  id: string;
  type: 'image' | 'video';
  publicUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export const uploadLocalProjectAsset = async ({
  projectId,
  file,
  fetchImpl = fetch,
}: {
  projectId: string;
  file: File;
  fetchImpl?: typeof fetch;
}): Promise<PersistedLocalProjectAsset> => {
  const formData = new FormData();
  formData.set('file', file, file.name);
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
