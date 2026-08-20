'use client';

import type { CanvasCard, CanvasDraftCard } from '@/core/beatcanvas/canvas-types';
import {
  isCanvasDraftCard,
  isCanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import { useCallback, useEffect, useRef, useState } from 'react';

export const resolveNextActiveComposerCardId = ({
  currentActiveComposerCardId,
  nextSelectedCanvasCardIds,
  cardsById,
}: {
  currentActiveComposerCardId: string | null;
  nextSelectedCanvasCardIds: string[];
  cardsById: Record<string, CanvasCard>;
}) => {
  if (
    nextSelectedCanvasCardIds.length === 1 &&
    isCanvasDraftCard(cardsById[nextSelectedCanvasCardIds[0]])
  ) {
    return nextSelectedCanvasCardIds[0] ?? null;
  }

  if (nextSelectedCanvasCardIds.length === 0) {
    return null;
  }

  return null;
};

export const reconcileCanvasCardsForAvailableShapes = (
  cardsById: Record<string, CanvasCard>,
  availableIds: Set<string>
) =>
  Object.fromEntries(
    Object.entries(cardsById)
      .filter(
        ([cardId, card]) =>
          availableIds.has(cardId) ||
          (isCanvasOutputCard(card) &&
            availableIds.has(card.sourceConfigCardId))
      )
      .map(([cardId, card]) => {
        const nextReferenceCardIds = card.referenceCardIds.filter(
          (referenceCardId) => availableIds.has(referenceCardId)
        );

        return [
          cardId,
          nextReferenceCardIds.length === card.referenceCardIds.length
            ? card
            : {
                ...card,
                referenceCardIds: nextReferenceCardIds,
              },
        ];
      })
  );

export function useBeatCanvasState() {
  const canvasCardsRef = useRef<Record<string, CanvasCard>>({});
  const [canvasCards, setCanvasCards] = useState<Record<string, CanvasCard>>(
    {}
  );
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedCanvasCardIds, setSelectedCanvasCardIds] = useState<string[]>(
    []
  );
  const [activeComposerCardId, setActiveComposerCardId] = useState<
    string | null
  >(null);

  const setCanvasCard = useCallback((card: CanvasCard) => {
    canvasCardsRef.current = {
      ...canvasCardsRef.current,
      [card.id]: card,
    };
    setCanvasCards((previous) => ({
      ...previous,
      [card.id]: card,
    }));
  }, []);

  const updateCanvasCard = useCallback(
    (
      cardId: string,
      updater: Partial<CanvasCard> | ((current: CanvasCard) => CanvasCard)
    ) => {
      const current = canvasCardsRef.current[cardId];
      if (!current) {
        return;
      }

      const nextCard =
        typeof updater === 'function'
          ? updater(current)
          : ({
              ...current,
              ...updater,
            } as CanvasCard);

      canvasCardsRef.current = {
        ...canvasCardsRef.current,
        [cardId]: nextCard,
      };
      setCanvasCards((previous) => ({
        ...previous,
        [cardId]: nextCard,
      }));
    },
    []
  );

  const updateDraftCard = useCallback(
    (
      draftId: string,
      updater:
        | Partial<CanvasDraftCard>
        | ((current: CanvasDraftCard) => CanvasDraftCard)
    ) => {
      const current = canvasCardsRef.current[draftId];
      if (!isCanvasDraftCard(current)) {
        return;
      }

      const nextCard =
        typeof updater === 'function'
          ? updater(current)
          : ({
              ...current,
              ...updater,
            } as CanvasDraftCard);

      canvasCardsRef.current = {
        ...canvasCardsRef.current,
        [draftId]: nextCard,
      };
      setCanvasCards((previous) => ({
        ...previous,
        [draftId]: nextCard,
      }));
    },
    []
  );

  const removeCanvasCard = useCallback((cardId: string) => {
    const nextCards = Object.fromEntries(
      Object.entries(canvasCardsRef.current).filter(
        ([currentCardId]) => currentCardId !== cardId
      )
    );

    canvasCardsRef.current = nextCards;
    setCanvasCards(nextCards);
    setSelectedCanvasCardIds((previous) =>
      previous.filter((currentCardId) => currentCardId !== cardId)
    );
    setActiveComposerCardId((current) => (current === cardId ? null : current));
  }, []);

  const replaceCanvasCards = useCallback(
    (nextCards: Record<string, CanvasCard>) => {
      canvasCardsRef.current = nextCards;
      setCanvasCards(nextCards);
      const availableIds = new Set(Object.keys(nextCards));
      setSelectedCanvasCardIds((previous) =>
        previous.filter((cardId) => availableIds.has(cardId))
      );
      setSelectedShapeIds((previous) =>
        previous.filter((shapeId) => availableIds.has(shapeId))
      );
      setActiveComposerCardId((current) =>
        current && availableIds.has(current) ? current : null
      );
    },
    []
  );

  const handleSelectedShapeIdsChange = useCallback((nextIds: string[]) => {
    setSelectedShapeIds(nextIds);
  }, []);

  const handleSelectedCanvasCardIdsChange = useCallback((nextIds: string[]) => {
    setSelectedCanvasCardIds(nextIds);
    setActiveComposerCardId((current) =>
      resolveNextActiveComposerCardId({
        currentActiveComposerCardId: current,
        nextSelectedCanvasCardIds: nextIds,
        cardsById: canvasCardsRef.current,
      })
    );
  }, []);

  const handleCanvasShapeIdsChange = useCallback((shapeIds: string[]) => {
    const availableIds = new Set(shapeIds);
    const nextCards = reconcileCanvasCardsForAvailableShapes(
      canvasCardsRef.current,
      availableIds
    );

    const nextCardsChanged =
      Object.keys(nextCards).length !==
        Object.keys(canvasCardsRef.current).length ||
      Object.entries(nextCards).some(
        ([cardId, card]) => canvasCardsRef.current[cardId] !== card
      );

    if (nextCardsChanged) {
      canvasCardsRef.current = nextCards;
      setCanvasCards(nextCards);
    }

    setSelectedCanvasCardIds((previous) =>
      previous.filter((cardId) => availableIds.has(cardId))
    );
    setSelectedShapeIds((previous) =>
      previous.filter((shapeId) => availableIds.has(shapeId))
    );
    setActiveComposerCardId((current) =>
      current && availableIds.has(current) ? current : null
    );
  }, []);

  useEffect(() => {
    canvasCardsRef.current = canvasCards;
  }, [canvasCards]);

  return {
    activeComposerCardId,
    canvasCards,
    canvasCardsRef,
    handleCanvasShapeIdsChange,
    handleSelectedShapeIdsChange,
    handleSelectedCanvasCardIdsChange,
    selectedShapeIds,
    selectedCanvasCardIds,
    removeCanvasCard,
    replaceCanvasCards,
    setActiveComposerCardId,
    setCanvasCard,
    updateCanvasCard,
    updateDraftCard,
  };
}
