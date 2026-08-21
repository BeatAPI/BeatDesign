import { uploadFileFromBrowser } from '@/core/workspace-storage/client';
import type { UploadFileResult } from '@/core/workspace-storage/types';

import type { CanvasCard, CanvasDraftCard } from './canvas-types';

export type PendingLocalReferenceUpload = {
  file: File;
  objectUrl: string;
};

type UploadFileFromBrowserImpl = typeof uploadFileFromBrowser;
type FetchImpl = typeof fetch;

export const isTransientCanvasUrl = (url: string | null | undefined) =>
  typeof url === 'string' &&
  (url.startsWith('blob:') || url.startsWith('data:'));

export const isLocalWorkspaceMediaUrl = (url: string | null | undefined) => {
  if (!url) return false;
  if (isTransientCanvasUrl(url)) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    if (origin) return parsed.origin === origin;
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const needsJustInTimeUpload = ({
  card,
  pendingUpload,
}: {
  card: CanvasCard | undefined;
  pendingUpload?: PendingLocalReferenceUpload;
}) => {
  if (!card || card.kind === 'generation') return false;
  if (pendingUpload && (!card.url || isTransientCanvasUrl(card.url))) {
    return true;
  }
  return Boolean(card.url && isLocalWorkspaceMediaUrl(card.url));
};

export const getPendingDraftReferenceUploadCount = ({
  draftCard,
  cardsById,
  pendingUploadsByCardId,
}: {
  draftCard: CanvasDraftCard;
  cardsById: Record<string, CanvasCard>;
  pendingUploadsByCardId: Record<string, PendingLocalReferenceUpload>;
}) => {
  const seenCardIds = new Set<string>();
  let count = 0;
  for (const cardId of draftCard.referenceCardIds) {
    if (seenCardIds.has(cardId)) continue;
    seenCardIds.add(cardId);
    if (
      needsJustInTimeUpload({
        card: cardsById[cardId],
        pendingUpload: pendingUploadsByCardId[cardId],
      })
    ) {
      count += 1;
    }
  }
  return count;
};

const fileFromWorkspaceUrl = async (
  url: string,
  fetchImpl: FetchImpl
): Promise<File> => {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('Failed to read a local canvas reference');
  }
  const blob = await response.blob();
  const filename = decodeURIComponent(
    url.split('/').pop()?.split('?')[0] || 'reference'
  );
  return new File([blob], filename, {
    type: blob.type || 'application/octet-stream',
  });
};

export const promotePendingDraftReferenceUploads = async ({
  draftCard,
  cardsById,
  pendingUploadsByCardId,
  projectId,
  generationIntentToken,
  uploadFileFromBrowserImpl = uploadFileFromBrowser,
  fetchImpl = fetch,
}: {
  draftCard: CanvasDraftCard;
  cardsById: Record<string, CanvasCard>;
  pendingUploadsByCardId: Record<string, PendingLocalReferenceUpload>;
  projectId: string;
  generationIntentToken: string;
  uploadFileFromBrowserImpl?: UploadFileFromBrowserImpl;
  fetchImpl?: FetchImpl;
}): Promise<
  Array<{
    cardId: string;
    objectUrl: string;
    uploadResult: UploadFileResult;
  }>
> => {
  const seenCardIds = new Set<string>();
  const promotions: Array<{
    cardId: string;
    objectUrl: string;
    uploadResult: UploadFileResult;
  }> = [];

  for (const cardId of draftCard.referenceCardIds) {
    if (seenCardIds.has(cardId)) {
      continue;
    }
    seenCardIds.add(cardId);

    const pendingUpload = pendingUploadsByCardId[cardId];
    const card = cardsById[cardId];
    if (
      !needsJustInTimeUpload({
        card,
        pendingUpload,
      })
    ) {
      continue;
    }

    const file =
      pendingUpload && (!card.url || isTransientCanvasUrl(card.url))
        ? pendingUpload.file
        : await fileFromWorkspaceUrl(card.url as string, fetchImpl);

    const uploadResult = await uploadFileFromBrowserImpl(
      file,
      'beatcanvas/uploads',
      {
        projectId,
        generationIntentToken,
      }
    );

    promotions.push({
      cardId,
      objectUrl: pendingUpload?.objectUrl || card.url || '',
      uploadResult,
    });
  }

  return promotions;
};
