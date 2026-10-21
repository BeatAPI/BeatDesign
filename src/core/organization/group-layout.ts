import type { CanvasCard } from '../beatcanvas/canvas-types';
import type {
  CanvasOrganizationDocument,
  CanvasOrganizationFrame as Frame,
  ShotGroup,
} from './canvas-organization';

export type GroupLayoutMode = 'tidy' | 'row' | 'column';
export const GROUP_LAYOUT = { padding: 24, header: 112, gap: 48, groupGap: 96 };

export function groupCardIds(
  document: CanvasOrganizationDocument,
  group: ShotGroup
): string[] {
  const members = new Set(group.memberCardIds);
  const otherMembers = new Set(
    Object.values(document.organization?.groups ?? {})
      .filter((value) => value.id !== group.id)
      .flatMap((value) => value.memberCardIds)
  );
  for (const card of document.cards) {
    if (
      card.kind === 'output' &&
      members.has(card.sourceConfigCardId) &&
      !otherMembers.has(card.id)
    )
      members.add(card.id);
  }
  return [...members];
}

export function visibleGroupCards(
  document: CanvasOrganizationDocument,
  group: ShotGroup
): CanvasCard[] {
  const ids = new Set(groupCardIds(document, group));
  return document.cards.filter(
    (card) =>
      ids.has(card.id) &&
      (card.kind !== 'output' ||
        card.generationSnapshot?.generationMode === 'analysis')
  );
}

/** The label and the six-item Take strip are rendered outside a generation's saved frame. */
export function cardVisualInsets(
  document: CanvasOrganizationDocument,
  card: CanvasCard
) {
  const frame = document.frames[card.id];
  if (card.kind !== 'generation' || (frame && frame.w <= 128 && frame.h <= 128))
    return { top: 0, right: 0, bottom: 0 };
  if (card.generationMode === 'analysis')
    return { top: 32, right: 0, bottom: 0 };
  const count = document.cards.filter(
    (value) => value.kind === 'output' && value.sourceConfigCardId === card.id
  ).length;
  const hasStrip =
    count > 1 || (count > 0 && ['pending', 'processing'].includes(card.status));
  return {
    top: 32,
    right: hasStrip ? 48 : 0,
    bottom: hasStrip
      ? Math.max(0, Math.min(6, count) * 42 - 6 - (frame?.h ?? 180))
      : 0,
  };
}

export function visibleCardFrame(
  document: CanvasOrganizationDocument,
  card: CanvasCard
): Frame | undefined {
  const frame = document.frames[card.id];
  if (!frame) return;
  const inset = cardVisualInsets(document, card);
  return {
    x: frame.x,
    y: frame.y - inset.top,
    w: frame.w + inset.right,
    h: frame.h + inset.top + inset.bottom,
  };
}

export function enclosingFrame(frames: Frame[]): Frame {
  const x = Math.min(...frames.map((frame) => frame.x));
  const y = Math.min(...frames.map((frame) => frame.y));
  return {
    x,
    y,
    w: Math.max(...frames.map((frame) => frame.x + frame.w)) - x,
    h: Math.max(...frames.map((frame) => frame.y + frame.h)) - y,
  };
}

export function fittedGroupFrame(
  document: CanvasOrganizationDocument,
  group: ShotGroup
): Frame {
  const frames = visibleGroupCards(document, group).flatMap((card) => {
    const frame = visibleCardFrame(document, card);
    return frame ? [frame] : [];
  });
  if (!frames.length) return { ...group.expandedFrame };
  const bounds = enclosingFrame(frames);
  return {
    x: bounds.x - GROUP_LAYOUT.padding,
    y: bounds.y - GROUP_LAYOUT.header,
    w: Math.max(320, bounds.w + GROUP_LAYOUT.padding * 2),
    h: Math.max(160, bounds.h + GROUP_LAYOUT.header + GROUP_LAYOUT.padding),
  };
}

/** Reading/rendering may grow the frame to enclose visible content, but never writes or moves it. */
export function displayedGroupFrame(
  document: CanvasOrganizationDocument,
  group: ShotGroup
): Frame {
  return group.collapsed
    ? { ...group.summaryFrame }
    : enclosingFrame([group.expandedFrame, fittedGroupFrame(document, group)]);
}

export function overlaps(a: Frame, b: Frame, gap = 0) {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

/** Stable cells handle mixed sizes; explicit group ordering is retained. */
function pack(
  frames: Frame[],
  mode: GroupLayoutMode,
  origin: { x: number; y: number },
  gap: number
): Frame[] {
  const averageWidth =
    frames.reduce((sum, frame) => sum + frame.w, 0) / frames.length;
  const averageHeight =
    frames.reduce((sum, frame) => sum + frame.h, 0) / frames.length;
  const columns =
    mode === 'row'
      ? frames.length
      : mode === 'column'
        ? 1
        : Math.max(
            1,
            Math.min(
              frames.length,
              Math.round(
                Math.sqrt(
                  ((frames.length * averageHeight) / averageWidth) * 1.6
                )
              )
            )
          );
  const widths = Array.from({ length: columns }, (_, col) =>
    Math.max(
      ...frames.filter((_, i) => i % columns === col).map((frame) => frame.w)
    )
  );
  const heights = Array.from(
    { length: Math.ceil(frames.length / columns) },
    (_, row) =>
      Math.max(
        ...frames
          .slice(row * columns, (row + 1) * columns)
          .map((frame) => frame.h)
      )
  );
  return frames.map((frame, i) => ({
    ...frame,
    x:
      origin.x +
      widths.slice(0, i % columns).reduce((sum, width) => sum + width + gap, 0),
    y:
      origin.y +
      heights
        .slice(0, Math.floor(i / columns))
        .reduce((sum, height) => sum + height + gap, 0),
  }));
}

function translate(
  document: CanvasOrganizationDocument,
  ids: string[],
  dx: number,
  dy: number
) {
  for (const id of new Set(ids)) {
    const frame = document.frames[id];
    if (frame)
      document.frames[id] = { ...frame, x: frame.x + dx, y: frame.y + dy };
  }
}

export function layoutGroup(
  document: CanvasOrganizationDocument,
  group: ShotGroup,
  mode: GroupLayoutMode
) {
  const cards = visibleGroupCards(document, group);
  if (!cards.length) return;
  const frames = cards.map((card) => {
    const frame = visibleCardFrame(document, card);
    if (!frame)
      throw new Error('Save member positions before arranging a group.');
    return frame;
  });
  const bounds = enclosingFrame(frames);
  const targets = pack(frames, mode, bounds, GROUP_LAYOUT.gap);
  const owned = new Set(groupCardIds(document, group));
  const visibleIds = new Set(cards.map((card) => card.id));
  cards.forEach((card, i) => {
    const dx = targets[i].x - frames[i].x,
      dy = targets[i].y - frames[i].y;
    const history = document.cards.filter(
      (value) =>
        value.kind === 'output' &&
        value.sourceConfigCardId === card.id &&
        owned.has(value.id) &&
        !visibleIds.has(value.id)
    );
    translate(document, [card.id, ...history.map((value) => value.id)], dx, dy);
  });
  group.expandedFrame = fittedGroupFrame(document, group);
}

export function arrangeGroups(
  document: CanvasOrganizationDocument,
  groups: ShotGroup[],
  mode: GroupLayoutMode
) {
  if (!groups.length) return;
  const selected = new Set(groups.map((group) => group.id));
  const allMembers = new Set(
    Object.values(document.organization?.groups ?? {}).flatMap((group) =>
      groupCardIds(document, group)
    )
  );
  const obstacles = [
    ...Object.values(document.organization?.groups ?? {})
      .filter((group) => !selected.has(group.id))
      .map((group) => displayedGroupFrame(document, group)),
    ...document.cards
      .filter(
        (card) =>
          !allMembers.has(card.id) &&
          (card.kind !== 'output' ||
            card.generationSnapshot?.generationMode === 'analysis')
      )
      .flatMap((card) => {
        const frame = visibleCardFrame(document, card);
        return frame ? [frame] : [];
      }),
  ];
  const frames = groups.map((group) => displayedGroupFrame(document, group));
  const targets = pack(
    frames,
    mode,
    enclosingFrame(frames),
    GROUP_LAYOUT.groupGap
  );
  groups.forEach((group, i) => {
    const target = targets[i];
    let collisions: Frame[];
    while (
      (collisions = obstacles.filter((frame) =>
        overlaps(target, frame, GROUP_LAYOUT.groupGap)
      )).length
    ) {
      target.y =
        Math.max(...collisions.map((frame) => frame.y + frame.h)) +
        GROUP_LAYOUT.groupGap;
    }
    const dx = target.x - frames[i].x,
      dy = target.y - frames[i].y;
    translate(document, groupCardIds(document, group), dx, dy);
    for (const key of ['summaryFrame', 'expandedFrame'] as const) {
      const frame = group[key];
      group[key] = { ...frame, x: frame.x + dx, y: frame.y + dy };
    }
    obstacles.push(target);
  });
}
