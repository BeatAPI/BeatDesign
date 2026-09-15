import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import type { CanvasOperation } from './canvas-commands';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Layout changes never carry stale card content into a command. */
export function buildCanvasOperations(
  base: ProjectSnapshotDocument | null,
  next: ProjectSnapshotDocument,
  allowEmpty = false
): CanvasOperation[] {
  if (base?.cards.length && !next.cards.length && !allowEmpty) {
    throw new Error('Unconfirmed empty canvas rejected.');
  }
  const previous = new Map(base?.cards.map((card) => [card.id, card]));
  const ids = new Set(next.cards.map((card) => card.id));
  const operations: CanvasOperation[] = [];
  for (const card of base?.cards ?? []) {
    if (!ids.has(card.id)) operations.push({ type: 'remove_card', cardId: card.id });
  }
  for (const card of next.cards) {
    const frame = next.frames[card.id];
    if (!equal(previous.get(card.id), card)) {
      operations.push({ type: 'upsert_card', card, ...(frame ? { frame } : {}) });
    } else if (frame && !equal(base?.frames[card.id], frame)) {
      operations.push({ type: 'move_card', cardId: card.id, frame });
    }
  }
  if (!equal(base?.camera, next.camera)) {
    operations.push({ type: 'set_camera', camera: next.camera ?? null });
  }
  if (!equal(base?.workflows?.activeTemplate, next.workflows?.activeTemplate)) {
    operations.push({ type: 'set_workflow', activeTemplate: next.workflows?.activeTemplate ?? null });
  }
  return operations;
}
