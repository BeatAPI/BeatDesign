import type { CanvasAssetCard, CanvasCard } from '@/core/beatcanvas/canvas-types';
import { resolveCanvasPlacement } from '@/core/beatcanvas/upload-layout';
import {
  normalizeProjectSnapshotDocument,
  type ProjectSnapshotDocument,
  type ProjectSnapshotShapeFrame,
} from '@/core/projects/project-snapshot';

export type CanvasOperation =
  | { type: 'set_camera'; camera: ProjectSnapshotDocument['camera'] | null }
  | { type: 'set_workflow'; activeTemplate: NonNullable<ProjectSnapshotDocument['workflows']>['activeTemplate'] }
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
      type: 'place_card';
      cardId: string;
      sourceCardIds?: string[];
      side?: 'left' | 'right';
      offsetIndex?: number;
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
  lastRenderAssetId,
  lastRenderUrl,
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
  const hasRenderUpdate =
    lastRenderAssetId !== undefined || lastRenderUrl !== undefined;
  const resolvedRenderAssetId =
    hasRenderUpdate
      ? (lastRenderAssetId ?? null)
      : (existing?.lastRenderAssetId ?? existing?.assetId ?? null);
  const resolvedRenderUrl =
    hasRenderUpdate ? (lastRenderUrl ?? null) : (existing?.url ?? null);
  const mergedRefs = Array.from(
    new Set([
      ...(existing?.referenceCardIds ?? []),
      ...referenceCardIds,
    ])
  );
  return {
    id: cardId,
    assetId: resolvedRenderAssetId,
    kind: 'asset',
    type: 'timeline',
    name,
    url: resolvedRenderUrl,
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
    lastRenderAssetId: resolvedRenderAssetId,
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
  let camera = source.camera;
  let workflows = source.workflows;
  const changedIds: string[] = [];

  for (const operation of operations) {
    if (operation.type === 'set_camera') {
      camera = operation.camera ?? undefined;
      continue;
    }
    if (operation.type === 'set_workflow') {
      workflows = { activeTemplate: operation.activeTemplate ?? null };
      continue;
    }
    if (operation.type === 'upsert_card') {
      const index = cards.findIndex((card) => card.id === operation.card.id);
      if (index < 0) cards.push(operation.card);
      else cards[index] = operation.card;
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

    if (operation.type === 'place_card') {
      const card = cards.find((item) => item.id === operation.cardId);
      if (!card) continue;
      const currentFrame = frames[operation.cardId];
      const size = {
        w: currentFrame?.w ?? 360,
        h: currentFrame?.h ?? 260,
      };
      const sourceCardIds = operation.sourceCardIds ?? card.referenceCardIds;
      const sourceFrames = sourceCardIds.flatMap((cardId) => {
        const frame = frames[cardId];
        return frame ? [frame] : [];
      });
      const occupied = Object.entries(frames).flatMap(([cardId, frame]) =>
        cardId === operation.cardId ? [] : [frame]
      );
      const position = resolveCanvasPlacement({
        sourceFrames,
        occupied,
        size,
        offsetIndex: operation.offsetIndex,
        side: operation.side,
      });
      frames[operation.cardId] = { ...position, ...size };
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
      camera,
      workflows,
    }),
    changedIds: Array.from(new Set(changedIds)),
  };
}
