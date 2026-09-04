export const CANVAS_BATCH_UPLOAD_GAP = 48;
export const CANVAS_BATCH_UPLOAD_COLUMNS = 3;

export type CanvasOccupiedFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CanvasPlacementSide = 'left' | 'right';

const framesOverlap = (
  left: CanvasOccupiedFrame,
  right: CanvasOccupiedFrame,
  gap: number
) =>
  left.x < right.x + right.w + gap &&
  left.x + left.w + gap > right.x &&
  left.y < right.y + right.h + gap &&
  left.y + left.h + gap > right.y;

export const resolveNonOverlappingPlacement = ({
  x,
  y,
  w,
  h,
  occupied,
  gap = CANVAS_BATCH_UPLOAD_GAP,
  direction = 'right',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  occupied: CanvasOccupiedFrame[];
  gap?: number;
  direction?: CanvasPlacementSide;
}) => {
  let next = { x, y, w, h };
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if (!occupied.some((frame) => framesOverlap(next, frame, gap))) {
      return { x: next.x, y: next.y };
    }
    next = {
      ...next,
      x:
        next.x +
        (direction === 'left' ? -(w + gap) : w + gap),
      y: attempt > 0 && attempt % CANVAS_BATCH_UPLOAD_COLUMNS === 0
        ? next.y + h + gap
        : next.y,
    };
    if (attempt > 0 && attempt % CANVAS_BATCH_UPLOAD_COLUMNS === 0) {
      next.x = x;
    }
  }
  return { x: next.x, y: next.y };
};

export const resolveCanvasPlacement = ({
  sourceFrames = [],
  occupied,
  size = { w: 360, h: 260 },
  offsetIndex = 0,
  side = 'right',
  origin = { x: 80, y: 80 },
  referenceGap = 96,
}: {
  sourceFrames?: CanvasOccupiedFrame[];
  occupied: CanvasOccupiedFrame[];
  size?: { w: number; h: number };
  offsetIndex?: number;
  side?: CanvasPlacementSide;
  origin?: { x: number; y: number };
  referenceGap?: number;
}) => {
  const offset = resolveCanvasBatchOffset(offsetIndex, size);
  let next = {
    x: origin.x + offset.x,
    y: origin.y + offset.y,
  };

  if (sourceFrames.length > 0) {
    const right = Math.max(
      ...sourceFrames.map((frame) => frame.x + frame.w)
    );
    const left = Math.min(...sourceFrames.map((frame) => frame.x));
    const top = Math.min(...sourceFrames.map((frame) => frame.y));
    const bottom = Math.max(
      ...sourceFrames.map((frame) => frame.y + frame.h)
    );
    next = {
      x:
        side === 'left'
          ? left - size.w - referenceGap - offset.x
          : right + referenceGap + offset.x,
      y: top + (bottom - top - size.h) / 2 + offset.y,
    };
  } else if (occupied.length > 0) {
    const edgeX =
      side === 'left'
        ? Math.min(...occupied.map((frame) => frame.x)) -
          size.w -
          CANVAS_BATCH_UPLOAD_GAP
        : Math.max(...occupied.map((frame) => frame.x + frame.w)) +
          CANVAS_BATCH_UPLOAD_GAP;
    const minY = Math.min(...occupied.map((frame) => frame.y));
    next = {
      x: edgeX + (side === 'left' ? -offset.x : offset.x),
      y: minY + offset.y,
    };
  }

  return resolveNonOverlappingPlacement({
    ...next,
    ...size,
    occupied,
    direction: side,
  });
};

export const resolveCanvasBatchOffset = (
  index: number,
  size: { w: number; h: number } = { w: 360, h: 360 }
) => {
  const safeIndex = Math.max(0, index);
  const column = safeIndex % CANVAS_BATCH_UPLOAD_COLUMNS;
  const row = Math.floor(safeIndex / CANVAS_BATCH_UPLOAD_COLUMNS);
  const stepX = Math.max(0, size.w) + CANVAS_BATCH_UPLOAD_GAP;
  const stepY = Math.max(0, size.h) + CANVAS_BATCH_UPLOAD_GAP;

  return {
    x: column * stepX,
    y: row * stepY,
  };
};
