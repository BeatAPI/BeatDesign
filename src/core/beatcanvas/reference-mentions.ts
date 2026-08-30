import type {
  CanvasCard,
  CanvasCardMediaType,
} from './canvas-types';

export type CanvasReferenceMention = {
  cardId: string;
  type: CanvasCardMediaType;
  index: number;
  alias: string;
  name: string;
};

export type ActiveCanvasReferenceMention = {
  start: number;
  end: number;
  query: string;
};

const REFERENCE_MENTION_PATTERN = /@(?:Image|Video)\d+/g;

export const getCanvasReferenceAlias = (
  type: CanvasCardMediaType,
  index: number
) => `@${type === 'video' ? 'Video' : 'Image'}${index}`;

export const buildCanvasReferenceMentions = ({
  referenceCardIds,
  cards,
}: {
  referenceCardIds: string[];
  cards: Record<string, CanvasCard | undefined>;
}): CanvasReferenceMention[] => {
  const counts: Record<CanvasCardMediaType, number> = {
    image: 0,
    video: 0,
  };

  return referenceCardIds.flatMap((cardId) => {
    const card = cards[cardId];
    if (!card || (card.type !== 'image' && card.type !== 'video')) return [];

    counts[card.type] += 1;
    const index = counts[card.type];
    return [
      {
        cardId,
        type: card.type,
        index,
        alias: getCanvasReferenceAlias(card.type, index),
        name: card.name,
      },
    ];
  });
};

export const findActiveCanvasReferenceMention = ({
  prompt,
  caret,
}: {
  prompt: string;
  caret: number;
}): ActiveCanvasReferenceMention | null => {
  const safeCaret = Math.max(0, Math.min(caret, prompt.length));
  const beforeCaret = prompt.slice(0, safeCaret);
  const match = /(?:^|[\s([{，。,:;；：])@([^\s@]*)$/u.exec(beforeCaret);
  if (!match) return null;

  const query = match[1] ?? '';
  const start = safeCaret - query.length - 1;
  return {
    start,
    end: safeCaret,
    query,
  };
};

export const filterCanvasReferenceMentions = ({
  mentions,
  query,
}: {
  mentions: CanvasReferenceMention[];
  query: string;
}) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return mentions;

  return mentions.filter((mention) =>
    `${mention.alias} ${mention.name} ${mention.type}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
};

export const insertCanvasReferenceMention = ({
  prompt,
  alias,
  selectionStart,
  selectionEnd,
  activeMention,
}: {
  prompt: string;
  alias: string;
  selectionStart: number;
  selectionEnd: number;
  activeMention?: ActiveCanvasReferenceMention | null;
}) => {
  const start = activeMention?.start ?? selectionStart;
  const end = activeMention?.end ?? selectionEnd;
  const before = prompt.slice(0, start);
  const after = prompt.slice(end);
  const leadingSpace = before && !/[\s([{，。,:;；：]$/u.test(before) ? ' ' : '';
  const trailingSpace = after && !/^[\s)\]}，。,:;；：]/u.test(after) ? ' ' : '';
  const insertion = `${leadingSpace}${alias}${trailingSpace}`;

  return {
    prompt: `${before}${insertion}${after}`,
    caret: start + insertion.length,
  };
};

export const rewriteCanvasReferenceAliases = ({
  prompt,
  previousMentions,
  nextMentions,
}: {
  prompt: string;
  previousMentions: CanvasReferenceMention[];
  nextMentions: CanvasReferenceMention[];
}) => {
  const previousByAlias = new Map(
    previousMentions.map((mention) => [mention.alias, mention])
  );
  const nextByCardId = new Map(
    nextMentions.map((mention) => [mention.cardId, mention])
  );
  const placeholders = new Map<string, string>();

  const withPlaceholders = prompt.replace(
    REFERENCE_MENTION_PATTERN,
    (alias) => {
      const previous = previousByAlias.get(alias);
      if (!previous) return alias;
      const placeholder = `\u0000beat-ref-${previous.cardId}\u0000`;
      placeholders.set(placeholder, previous.cardId);
      return placeholder;
    }
  );

  let nextPrompt = withPlaceholders;
  for (const [placeholder, cardId] of placeholders) {
    const previous = previousMentions.find(
      (mention) => mention.cardId === cardId
    );
    const next = nextByCardId.get(cardId);
    nextPrompt = nextPrompt.split(placeholder).join(
      next?.alias ?? `@Removed${previous?.type === 'video' ? 'Video' : 'Image'}`
    );
  }

  return nextPrompt;
};

export const moveCanvasReferenceCardId = ({
  referenceCardIds,
  activeCardId,
  overCardId,
}: {
  referenceCardIds: string[];
  activeCardId: string;
  overCardId: string;
}) => {
  const fromIndex = referenceCardIds.indexOf(activeCardId);
  const toIndex = referenceCardIds.indexOf(overCardId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return referenceCardIds;
  }

  const next = [...referenceCardIds];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return referenceCardIds;
  next.splice(toIndex, 0, moved);
  return next;
};
