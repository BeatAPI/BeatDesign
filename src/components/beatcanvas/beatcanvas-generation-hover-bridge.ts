type GenerationCardHoverCallback = (
  cardId: string,
  isPointerWithinCard: boolean
) => void;

let activeCallback: GenerationCardHoverCallback | null = null;

export function registerGenerationCardHoverCallback(
  callback: GenerationCardHoverCallback | null
) {
  activeCallback = callback;
}

export function fireGenerationCardHover(
  cardId: string,
  isPointerWithinCard: boolean
) {
  activeCallback?.(cardId, isPointerWithinCard);
}
