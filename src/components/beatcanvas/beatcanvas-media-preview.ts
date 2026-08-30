import type { CanvasCard } from '@/core/beatcanvas/canvas-types';

export const isDownloadableCanvasCard = (
  card: CanvasCard | null | undefined
) =>
  Boolean(
    card?.url &&
      card.generationMode !== 'analysis' &&
      !(
        card.type === 'image' && card.url.startsWith('data:image/svg+xml')
      )
  );

export const isPreviewableCanvasCard = (
  card: CanvasCard | null | undefined
): card is CanvasCard & { type: 'image' | 'video'; url: string } =>
  Boolean(
    isDownloadableCanvasCard(card) &&
      card &&
      (card.type === 'video' ||
        card.type === 'image')
  );

export const getPreviewableCanvasCardFromSelection = ({
  selectedSingleCard,
  selectedGroupCards,
}: {
  selectedSingleCard: CanvasCard | null | undefined;
  selectedGroupCards: CanvasCard[];
}) => {
  if (isPreviewableCanvasCard(selectedSingleCard)) {
    return selectedSingleCard;
  }

  const previewableGroupCards = selectedGroupCards.filter(
    isPreviewableCanvasCard
  );

  return previewableGroupCards.length === 1 ? previewableGroupCards[0] : null;
};

export const resolveBatchCanvasCardSelection = ({
  cardsById,
  selectedCanvasCardIds,
  selectedGroupCards,
}: {
  cardsById: Record<string, CanvasCard>;
  selectedCanvasCardIds: string[];
  selectedGroupCards: CanvasCard[];
}) => {
  if (selectedGroupCards.length > 0) {
    return selectedGroupCards;
  }

  if (selectedCanvasCardIds.length < 2) {
    return [];
  }

  return selectedCanvasCardIds
    .map((cardId) => cardsById[cardId])
    .filter((card): card is CanvasCard => Boolean(card));
};
