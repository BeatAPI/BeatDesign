import type {
  CanvasAssetCard,
  CanvasCard,
} from '@/core/beatcanvas/canvas-types';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import {
  buildCanvasReferenceMentions,
  rewriteCanvasReferenceAliases,
} from '@/core/beatcanvas/reference-mentions';
import { resolveCanvasPlacement } from '@/core/beatcanvas/upload-layout';
import {
  canvasOrganizationOperationSchema,
  applyCanvasOrganizationOperations,
  cleanupCanvasOrganizationForRemovedCards,
  type CanvasOrganizationOperation,
} from '@/core/organization/canvas-organization';
import {
  normalizeProjectSnapshotDocument,
  type ProjectSnapshotDocument,
  type ProjectSnapshotShapeFrame,
} from '@/core/projects/project-snapshot';

export type CanvasOperation =
  | CanvasOrganizationOperation
  | {
      type: 'set_canvas_organization';
      organization: ProjectSnapshotDocument['organization'] | null;
    }
  | {
      type: 'upsert_text';
      cardId: string;
      name?: string;
      textContent?: string;
      textRole?: import('@/core/beatcanvas/canvas-types').CanvasTextRole;
      frame?: ProjectSnapshotShapeFrame;
    }
  | { type: 'set_camera'; camera: ProjectSnapshotDocument['camera'] | null }
  | {
      type: 'set_workflow';
      activeTemplate: NonNullable<
        ProjectSnapshotDocument['workflows']
      >['activeTemplate'];
    }
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
  const resolvedRenderAssetId = hasRenderUpdate
    ? (lastRenderAssetId ?? null)
    : (existing?.lastRenderAssetId ?? existing?.assetId ?? null);
  const resolvedRenderUrl = hasRenderUpdate
    ? (lastRenderUrl ?? null)
    : (existing?.url ?? null);
  const mergedRefs = Array.from(
    new Set([...(existing?.referenceCardIds ?? []), ...referenceCardIds])
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
  if (operations.length > 500)
    throw new Error('At most 500 Canvas operations per batch.');
  let cards = structuredClone(source.cards);
  let frames = structuredClone(source.frames);
  let camera = source.camera;
  let workflows = source.workflows;
  let organization = source.organization;
  const changedIds: string[] = [];
  const removedIds = new Set<string>();

  for (const operation of operations) {
    if (operation.type === 'set_canvas_organization') {
      organization = operation.organization ?? undefined;
      continue;
    }
    const organizationOperation =
      canvasOrganizationOperationSchema.safeParse(operation);
    if (organizationOperation.success) {
      // Relational invariants apply to the final mixed batch: moving a member
      // between groups may temporarily put it in both groups within this loop.
      const result = applyCanvasOrganizationOperations(
        { ...source, cards, frames, organization },
        [organizationOperation.data],
        { validate: false }
      );
      organization = result.document.organization;
      cards = result.document.cards;
      frames = result.document.frames;
      changedIds.push(...result.changedIds);
      continue;
    }
    // Organization operations have already been consumed; keep the legacy branches unchanged.
    if (operation.type === 'set_camera') {
      camera = operation.camera ?? undefined;
      continue;
    }
    if (operation.type === 'set_workflow') {
      workflows = { activeTemplate: operation.activeTemplate ?? null };
      continue;
    }
    if (operation.type === 'upsert_text') {
      const existing = cards.find((card) => card.id === operation.cardId);
      if (existing && existing.kind !== 'text')
        throw new Error('This card is not a text node.');
      const card = buildTextCard({
        id: operation.cardId,
        name: operation.name ?? existing?.name ?? 'Text',
        textContent: operation.textContent ?? existing?.textContent ?? '',
        textRole: operation.textRole ?? existing?.textRole ?? 'note',
      });
      cards = [...cards.filter((item) => item.id !== card.id), card];
      if (operation.frame) frames[card.id] = operation.frame;
      else if (!frames[card.id])
        frames[card.id] = { x: 80, y: 80, w: 420, h: 360 };
      changedIds.push(card.id);
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
      const previousCards = Object.fromEntries(
        cards.map((card) => [card.id, card])
      );
      cards = cards.filter((card) => card.id !== operation.cardId);
      removedIds.add(operation.cardId);
      delete frames[operation.cardId];
      cards = cards.map((card) => ({
        ...card,
        ...(card.kind === 'generation'
          ? {
              prompt: rewriteCanvasReferenceAliases({
                prompt: card.prompt,
                previousMentions: buildCanvasReferenceMentions({
                  cards: previousCards,
                  referenceCardIds: card.referenceCardIds,
                }),
                nextMentions: buildCanvasReferenceMentions({
                  cards: previousCards,
                  referenceCardIds: card.referenceCardIds.filter(
                    (id) => id !== operation.cardId
                  ),
                }),
              }),
            }
          : {}),
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
      frames[cardId] = operation.frame ??
        frames[cardId] ?? {
          x: maxX + 64,
          y: 80,
          w: 360,
          h: 220,
        };
      changedIds.push(cardId);
      continue;
    }

    if (operation.type !== 'set_references') continue;
    const cardIndex = cards.findIndex((card) => card.id === operation.cardId);
    if (cardIndex < 0) continue;
    const knownIds = new Set(cards.map((card) => card.id));
    const previousCard = cards[cardIndex];
    cards[cardIndex] = {
      ...cards[cardIndex],
      referenceCardIds: Array.from(
        new Set(
          operation.referenceCardIds.filter(
            (referenceCardId) =>
              referenceCardId !== operation.cardId &&
              knownIds.has(referenceCardId)
          )
        )
      ),
    } as CanvasCard;
    if (previousCard.kind === 'generation') {
      const byId = Object.fromEntries(cards.map((card) => [card.id, card]));
      cards[cardIndex].prompt = rewriteCanvasReferenceAliases({
        prompt: previousCard.prompt,
        previousMentions: buildCanvasReferenceMentions({
          cards: byId,
          referenceCardIds: previousCard.referenceCardIds,
        }),
        nextMentions: buildCanvasReferenceMentions({
          cards: byId,
          referenceCardIds: cards[cardIndex].referenceCardIds,
        }),
      });
    }
    changedIds.push(operation.cardId);
  }

  const updated = {
    ...source,
    cards,
    frames,
    camera,
    workflows,
    organization,
  };
  const finalDocument = organization
    ? cleanupCanvasOrganizationForRemovedCards(
        updated,
        [...removedIds].filter((id) => !cards.some((card) => card.id === id))
      )
    : updated;
  return {
    document: normalizeProjectSnapshotDocument(finalDocument),
    changedIds: Array.from(new Set(changedIds)),
  };
}
