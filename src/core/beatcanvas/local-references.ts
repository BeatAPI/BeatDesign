import { uploadFileFromBrowser } from '@/core/workspace-storage/client';
import type { UploadFileResult } from '@/core/workspace-storage/types';

import type { CanvasCard, CanvasDraftCard } from './canvas-types';

export type PendingLocalReferenceUpload = {
  file: File;
  objectUrl: string;
};

type UploadFileFromBrowserImpl = typeof uploadFileFromBrowser;

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
    const card = cardsById[cardId];
    if (
      pendingUploadsByCardId[cardId] &&
      card &&
      card.kind !== 'generation' &&
      (!card.url || isTransientCanvasUrl(card.url))
    ) {
      count += 1;
    }
  }
  return count;
};

export const isTransientCanvasUrl = (url: string | null | undefined) =>
  typeof url === 'string' &&
  (url.startsWith('blob:') || url.startsWith('data:'));

export const promotePendingDraftReferenceUploads = async ({
  draftCard,
  cardsById,
  pendingUploadsByCardId,
  projectId,
  generationIntentToken,
  uploadFileFromBrowserImpl = uploadFileFromBrowser,
}: {
  draftCard: CanvasDraftCard;
  cardsById: Record<string, CanvasCard>;
  pendingUploadsByCardId: Record<string, PendingLocalReferenceUpload>;
  projectId: string;
  generationIntentToken: string;
  uploadFileFromBrowserImpl?: UploadFileFromBrowserImpl;
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
    if (!pendingUpload || !card || card.kind === 'generation') {
      continue;
    }

    if (card.url && !isTransientCanvasUrl(card.url)) {
      continue;
    }

    const uploadResult = await uploadFileFromBrowserImpl(
      pendingUpload.file,
      'beatcanvas/uploads',
      {
        projectId,
        generationIntentToken,
      }
    );

    promotions.push({
      cardId,
      objectUrl: pendingUpload.objectUrl,
      uploadResult,
    });
  }

  return promotions;
};
