export type WorkflowCardType = 'image' | 'video';
export type WorkflowCardRole = 'asset';
export type WorkflowTaskType = 'image' | 'video';

export type WorkflowReferenceCard = {
  id: string;
  name: string;
  type: WorkflowCardType;
  url: string;
  role: WorkflowCardRole;
};

export type WorkflowDraft = {
  taskType: WorkflowTaskType;
  prompt: string;
  referenceCardIds: string[];
  referenceUrls: string[];
};

export const canCombineCards = (cards: WorkflowReferenceCard[]) =>
  cards.length === 2 && cards.every((card) => card.type === 'image');

export const buildBlendGenerationDraft = ({
  left,
  right,
}: {
  left: WorkflowReferenceCard;
  right: WorkflowReferenceCard;
}): WorkflowDraft => ({
  taskType: 'image',
  prompt: [
    'Create Card C by combining Card A and Card B into one polished creative visual.',
    `Card A: ${left.name}.`,
    `Card B: ${right.name}.`,
    'Card C should preserve the main product identity from Card A while borrowing styling, composition, or atmosphere cues from Card B.',
    'Return one polished result that can still be iterated with model switching and prompt edits.',
  ].join(' '),
  referenceCardIds: [left.id, right.id],
  referenceUrls: [left.url, right.url],
});

export const resolveReferencePayload = ({
  cards,
  taskType,
}: {
  cards: WorkflowReferenceCard[];
  taskType: WorkflowTaskType;
}) => {
  const imageCards = cards.filter((card) => card.type === 'image');
  const videoCards = cards.filter((card) => card.type === 'video');
  const imageUrls = imageCards.map((card) => card.url);

  if (taskType === 'video') {
    return {
      imageUrls,
      videoUrls: videoCards.map((card) => card.url),
    };
  }

  return {
    imageUrls,
    videoUrls: [],
  };
};
