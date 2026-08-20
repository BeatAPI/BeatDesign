import type {
  CanvasCard,
  CanvasCardMediaType,
  CanvasCardStatus,
  CanvasOutputCard,
} from './canvas-types';
import { isCanvasOutputCard } from './canvas-types';

export type GenerationTake = {
  id: string;
  url: string | null;
  type: CanvasCardMediaType;
  status: CanvasCardStatus;
  takeNumber: number;
  isPinned: boolean;
};

export const listGenerationOutputsForDraft = (
  cards: Record<string, CanvasCard | undefined>,
  draftId: string
) =>
  Object.values(cards)
    .filter(
      (card): card is CanvasOutputCard =>
        isCanvasOutputCard(card) && card.sourceConfigCardId === draftId
    )
    .sort(
      (left, right) =>
        right.generationSnapshot.capturedAt.localeCompare(
          left.generationSnapshot.capturedAt
        ) || right.id.localeCompare(left.id)
    );

export const resolvePinnedGenerationOutputId = ({
  outputs,
  pinnedOutputId,
}: {
  outputs: CanvasOutputCard[];
  pinnedOutputId?: string | null;
}) => {
  if (
    pinnedOutputId &&
    outputs.some((output) => output.id === pinnedOutputId)
  ) {
    return pinnedOutputId;
  }

  return (
    outputs.find((output) => output.status === 'succeeded' && Boolean(output.url))
      ?.id ??
    outputs[0]?.id ??
    null
  );
};

export const buildGenerationTakes = ({
  outputs,
  pinnedOutputId,
}: {
  outputs: CanvasOutputCard[];
  pinnedOutputId?: string | null;
}): GenerationTake[] => {
  const chronological = [...outputs].sort(
    (left, right) =>
      left.generationSnapshot.capturedAt.localeCompare(
        right.generationSnapshot.capturedAt
      ) || left.id.localeCompare(right.id)
  );
  const resolvedPinnedId = resolvePinnedGenerationOutputId({
    outputs: chronological,
    pinnedOutputId,
  });

  return chronological.map((output, index) => ({
    id: output.id,
    url: output.url,
    type: output.type,
    status: output.status,
    takeNumber: index + 1,
    isPinned: output.id === resolvedPinnedId,
  }));
};
