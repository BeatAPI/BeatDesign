import type {
  CanvasCard,
  CanvasTextCard,
  CanvasTextReference,
  CanvasTextRole,
} from './canvas-types';

export const MAX_TEXT_NODE_CHARS = 100_000;

export function buildTextCard({
  id,
  name,
  textContent = '',
  textRole = 'note',
}: {
  id: string;
  name: string;
  textContent?: string;
  textRole?: CanvasTextRole;
}): CanvasTextCard {
  return {
    id,
    kind: 'text',
    type: 'text',
    name,
    textContent,
    textRole,
    url: null,
    prompt: '',
    referenceCardIds: [],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    modelId: '',
    aspectRatio: '1:1',
    outputQuality: '1k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    sourceGenerationId: null,
  };
}

/** Text is prompt context, never a media upload or an image/video slot. */
export function resolveCanvasTextReferences({
  cards,
  referenceCardIds,
  prompt,
}: {
  cards: Record<string, CanvasCard | undefined>;
  referenceCardIds: string[];
  prompt: string;
}) {
  const textReferences: CanvasTextReference[] = [];
  for (const cardId of new Set(referenceCardIds)) {
    const card = cards[cardId];
    if (card?.kind !== 'text') continue;
    if (!card.textContent.trim())
      throw new Error(`Text node "${card.name}" is empty.`);
    textReferences.push({
      cardId,
      name: card.name,
      textRole: card.textRole,
      textContent: card.textContent,
    });
  }
  for (const match of prompt.matchAll(/@Text(\d+)\b/g)) {
    const index = Number(match[1]);
    if (index < 1 || index > textReferences.length) {
      throw new Error(
        `Text reference ${match[0]} is missing. Attach the text node again.`
      );
    }
  }
  if (/@RemovedText\b/.test(prompt))
    throw new Error(
      'A text reference was removed. Review the prompt before generating.'
    );
  // Do not recursively interpret text or aliases inside a document. Media aliases
  // retain their own numbering, regardless of how many text nodes are connected.
  const context = textReferences
    .map(
      (ref, index) =>
        `[Text${index + 1}: ${ref.name} (${ref.textRole})]\n${ref.textContent}`
    )
    .join('\n\n');
  const resolvedPrompt = [context, prompt.trim()].filter(Boolean).join('\n\n');
  return { resolvedPrompt, textReferences };
}
