import type { CanvasAssetCard, CanvasCard } from '@/core/beatcanvas/canvas-types';
import {
  normalizeProjectSnapshotDocument,
  type ProjectSnapshotDocument,
  type ProjectSnapshotShapeFrame,
} from '@/core/projects/project-snapshot';

export type CanvasOperation =
  | {
      type: 'upsert_card';
      card: CanvasCard;
      frame?: ProjectSnapshotShapeFrame;
    }
  | { type: 'remove_card'; cardId: string }
  | {
      type: 'move_card';
      cardId: string;
      frame: ProjectSnapshotShapeFrame;
    }
  | {
      type: 'set_references';
      cardId: string;
      referenceCardIds: string[];
    }
  | {
      type: 'upsert_timeline_node';
      timelineId: string;
      name: string;
      durationSec: number;
      clipCount: number;
      lastRenderAssetId?: string | null;
      lastRenderUrl?: string | null;
      referenceCardIds?: string[];
      frame?: ProjectSnapshotShapeFrame;
    };

export const timelineCanvasCardId = (timelineId: string) =>
  `timeline:${timelineId}`;

export function buildTimelineCanvasCard({
  existing,
  timelineId,
  name,
  durationSec,
  clipCount,
  lastRenderAssetId = null,
  lastRenderUrl = null,
  referenceCardIds = [],
}: {
  existing?: CanvasCard;
  timelineId: string;
  name: string;
  durationSec: number;
  clipCount: number;
  lastRenderAssetId?: string | null;
  lastRenderUrl?: string | null;
  referenceCardIds?: string[];
}): CanvasAssetCard {
  const cardId = timelineCanvasCardId(timelineId);
  const mergedRefs = Array.from(
    new Set([
      ...(existing?.referenceCardIds ?? []),
      ...referenceCardIds,
    ])
  );
  return {
    id: cardId,
    assetId: lastRenderAssetId ?? existing?.assetId ?? null,
    kind: 'asset',
    type: 'timeline',
    name,
    url: lastRenderUrl ?? existing?.url ?? null,
    prompt: existing?.prompt ?? '',
    referenceCardIds: mergedRefs,
    workflowTemplateId: existing?.workflowTemplateId ?? null,
    status: 'succeeded',
    error: null,
    modelId: existing?.modelId ?? '',
    aspectRatio: existing?.aspectRatio ?? '16:9',
    outputQuality: existing?.outputQuality ?? '1080p',
    duration: existing?.duration ?? '5s',
    mode: existing?.mode ?? 'quality',
    variant: existing?.variant ?? 'standard',
    quality: existing?.quality ?? 'standard',
    sourceGenerationId: existing?.sourceGenerationId ?? null,
    durationSec,
    timelineId,
    clipCount,
    lastRenderAssetId: lastRenderAssetId ?? existing?.lastRenderAssetId ?? null,
  };
}
export type CanvasCommandApplication = {
  document: ProjectSnapshotDocument;
  changedIds: string[];
};

export function applyCanvasOperations(
  source: ProjectSnapshotDocument,
  operations: readonly CanvasOperation[]
): CanvasCommandApplication {
  let cards = [...source.cards];
  let frames = { ...source.frames };
  const changedIds: string[] = [];

  for (const operation of operations) {
    if (operation.type === 'upsert_card') {
      cards = [
        ...cards.filter((card) => card.id !== operation.card.id),
        operation.card,
      ];
      if (operation.frame) {
        frames[operation.card.id] = operation.frame;
      }
      changedIds.push(operation.card.id);
      continue;
    }

    if (operation.type === 'remove_card') {
      if (!cards.some((card) => card.id === operation.cardId)) continue;
      cards = cards.filter((card) => card.id !== operation.cardId);
      delete frames[operation.cardId];
      cards = cards.map((card) => ({
        ...card,
        referenceCardIds: card.referenceCardIds.filter(
          (referenceCardId) => referenceCardId !== operation.cardId
        ),
      }));
      changedIds.push(operation.cardId);
      continue;
    }

    if (operation.type === 'move_card') {
      if (!cards.some((card) => card.id === operation.cardId)) continue;
      frames[operation.cardId] = operation.frame;
      changedIds.push(operation.cardId);
      continue;
    }

    if (operation.type === 'upsert_timeline_node') {
      const cardId = timelineCanvasCardId(operation.timelineId);
      const existing = cards.find((card) => card.id === cardId);
      const card = buildTimelineCanvasCard({
        existing,
        timelineId: operation.timelineId,
        name: operation.name,
        durationSec: operation.durationSec,
        clipCount: operation.clipCount,
        lastRenderAssetId: operation.lastRenderAssetId,
        lastRenderUrl: operation.lastRenderUrl,
        referenceCardIds: operation.referenceCardIds,
      });
      cards = [...cards.filter((item) => item.id !== cardId), card];
      const maxX = Object.values(frames).reduce(
        (value, frame) => Math.max(value, frame.x + frame.w),
        0
      );
      frames[cardId] =
        operation.frame ??
        frames[cardId] ?? {
          x: maxX + 64,
          y: 80,
          w: 360,
          h: 220,
        };
      changedIds.push(cardId);
      continue;
    }

    const cardIndex = cards.findIndex((card) => card.id === operation.cardId);
    if (cardIndex < 0) continue;
    const knownIds = new Set(cards.map((card) => card.id));
    cards[cardIndex] = {
      ...cards[cardIndex],
      referenceCardIds: Array.from(
        new Set(
          operation.referenceCardIds.filter(
            (referenceCardId) =>
              referenceCardId !== operation.cardId && knownIds.has(referenceCardId)
          )
        )
      ),
    } as CanvasCard;
    changedIds.push(operation.cardId);
  }

  return {
    document: normalizeProjectSnapshotDocument({
      ...source,
      cards,
      frames,
    }),
    changedIds: Array.from(new Set(changedIds)),
  };
}
