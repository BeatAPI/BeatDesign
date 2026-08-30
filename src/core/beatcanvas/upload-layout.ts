export const CANVAS_BATCH_UPLOAD_GAP = 48;
export const CANVAS_BATCH_UPLOAD_COLUMNS = 3;

export type CanvasOccupiedFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

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
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  occupied: CanvasOccupiedFrame[];
  gap?: number;
}) => {
  let next = { x, y, w, h };
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if (!occupied.some((frame) => framesOverlap(next, frame, gap))) {
      return { x: next.x, y: next.y };
    }
    next = {
      ...next,
      x: next.x + w + gap,
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
