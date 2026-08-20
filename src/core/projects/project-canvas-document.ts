import {
  type CanvasCard,
  type CanvasDraftCard,
  type CanvasGenerationCard,
  type CanvasOutputCard,
  isCanvasDraftCard,
  isCanvasGenerationCard,
  isCanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';

import { isTransientCanvasUrl } from '@/core/beatcanvas/local-references';
import type {
  ProjectSnapshotDocument,
  ProjectSnapshotShapeFrame,
} from './project-snapshot';

type SnapshotFramesById = Record<string, ProjectSnapshotShapeFrame>;
type NonDraftCanvasCard = CanvasCard & {
  kind: 'asset';
  url: string;
};

export const mergeCanvasRuntimeCardsIntoHistoryDocument = ({
  target,
  current,
}: {
  target: ProjectSnapshotDocument;
  current: ProjectSnapshotDocument;
}): ProjectSnapshotDocument => {
  const nextCardsById = new Map(
    target.cards.map((card) => [card.id, { ...card }] as const)
  );
  const currentCardsById = new Map(
    current.cards.map((card) => [card.id, card] as const)
  );

  for (const currentCard of current.cards) {
    if (currentCard.kind === 'output') {
      nextCardsById.set(currentCard.id, currentCard);
      const sourceConfigCard = currentCard.sourceConfigCardId
        ? currentCardsById.get(currentCard.sourceConfigCardId)
        : null;
      if (sourceConfigCard && !nextCardsById.has(sourceConfigCard.id)) {
        nextCardsById.set(sourceConfigCard.id, sourceConfigCard);
      }
      continue;
    }

    const targetCard = nextCardsById.get(currentCard.id);
    if (
      targetCard?.kind === 'generation' &&
      currentCard.kind === 'generation' &&
      (currentCard.status === 'pending' || currentCard.status === 'processing')
    ) {
      nextCardsById.set(currentCard.id, {
        ...targetCard,
        status: currentCard.status,
        error: currentCard.error,
      });
    }
  }

  const frames = { ...target.frames };
  for (const cardId of nextCardsById.keys()) {
    if (!frames[cardId] && current.frames[cardId]) {
      frames[cardId] = current.frames[cardId];
    }
  }

  return {
    ...target,
    cards: [...nextCardsById.values()].sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
    frames,
  };
};

export const buildProjectSnapshotDocument = ({
  cardsById,
  framesById,
}: {
  cardsById: Record<string, CanvasCard>;
  framesById: SnapshotFramesById;
}): ProjectSnapshotDocument => {
  const persistableCards = Object.values(cardsById).filter(
    (card) => !isTransientCanvasUrl(card.url)
  );
  const knownCardIds = new Set(persistableCards.map((card) => card.id));
  const cards = persistableCards
    .map((card) => ({
      ...card,
      referenceCardIds: card.referenceCardIds.filter((cardId) =>
        knownCardIds.has(cardId)
      ),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const frames = Object.entries(framesById).reduce<SnapshotFramesById>(
    (accumulator, [cardId, frame]) => {
      if (knownCardIds.has(cardId)) {
        accumulator[cardId] = frame;
      }
      return accumulator;
    },
    {}
  );

  return {
    version: 3,
    cards,
    frames,
  };
};

type SnapshotRestoreCard<TCard extends CanvasCard> = {
  card: TCard;
  frame?: ProjectSnapshotShapeFrame;
};

type SnapshotConnector = {
  sourceCardId: string;
  targetCardId: string;
};

export type ProjectSnapshotRestorePlan = {
  assetCards: Array<SnapshotRestoreCard<NonDraftCanvasCard>>;
  draftCards: Array<SnapshotRestoreCard<CanvasGenerationCard>>;
  outputCards: Array<SnapshotRestoreCard<CanvasOutputCard>>;
  connectors: SnapshotConnector[];
};

export const createProjectSnapshotRestorePlan = (
  document: ProjectSnapshotDocument
): ProjectSnapshotRestorePlan => {
  const outputSourceById = new Map(
    document.cards
      .filter(isCanvasOutputCard)
      .map((card) => [card.id, card.sourceConfigCardId] as const)
  );
  const normalizeVisibleReferences = <TCard extends CanvasCard>(card: TCard) =>
    ({
      ...card,
      referenceCardIds: Array.from(
        new Set(
          card.referenceCardIds.map(
            (referenceCardId) =>
              outputSourceById.get(referenceCardId) ?? referenceCardId
          )
        )
      ),
    }) as TCard;
  const assetCards = document.cards
    .filter(
      (card): card is NonDraftCanvasCard =>
        card.kind === 'asset' &&
        typeof card.url === 'string' &&
        card.url.length > 0
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((card) => ({
      card: normalizeVisibleReferences(card),
      frame: document.frames[card.id],
    }));

  const draftCards = document.cards
    .filter(isCanvasGenerationCard)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((card) => ({
      card: normalizeVisibleReferences(card),
      frame: document.frames[card.id],
    }));

  const outputCards = document.cards
    .filter(isCanvasOutputCard)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((card) => ({
      card,
      frame: document.frames[card.id],
    }));

  const connectorIds = new Set<string>();
  const connectors: SnapshotConnector[] = [];

  for (const current of [...assetCards, ...draftCards]) {
    for (const referenceCardId of current.card.referenceCardIds) {
      const connectorId = `${referenceCardId}->${current.card.id}`;
      if (connectorIds.has(connectorId)) {
        continue;
      }

      connectorIds.add(connectorId);
      connectors.push({
        sourceCardId: referenceCardId,
        targetCardId: current.card.id,
      });
    }
  }

  return {
    assetCards,
    draftCards,
    outputCards,
    connectors,
  };
};
