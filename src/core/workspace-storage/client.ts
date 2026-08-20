import type { UploadFileResult } from './types';

type BrowserUploadOptions = {
  projectId: string;
  generationIntentToken: string;
  fetch?: typeof fetch;
};

export const uploadFileFromBrowser = async (
  file: File,
  _folder?: string,
  options?: BrowserUploadOptions
): Promise<UploadFileResult> => {
  const formData = new FormData();
  formData.set('file', file, file.name);
  if (!options?.projectId || !options.generationIntentToken) {
    throw new Error('A confirmed generation is required before upload');
  }
  formData.set('projectId', options.projectId);
  formData.set('generationIntentToken', options.generationIntentToken);

  const response = await (options?.fetch ?? fetch)('/api/storage/upload', {
    method: 'POST',
    headers: {
      'x-beatapi-project-id': options.projectId,
      'x-beatapi-generation-intent': options.generationIntentToken,
    },
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    url?: string;
    key?: string;
  } | null;
  if (!response.ok || !payload?.url || !payload.key) {
    throw new Error(payload?.error || 'Failed to upload file');
  }
  return { url: payload.url, key: payload.key };
};
