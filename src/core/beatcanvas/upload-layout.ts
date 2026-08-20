export const CANVAS_BATCH_UPLOAD_GAP = 48;
export const CANVAS_BATCH_UPLOAD_COLUMNS = 3;

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
