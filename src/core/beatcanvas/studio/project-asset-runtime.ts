export type AssetShapeSize = { w: number; h: number };

const MAX_ASSET_EDGE = 360;
const SHAPE_SIZE_STEP = 8;

export const computeAdaptiveAssetSize = (
  naturalWidth: number,
  naturalHeight: number
): AssetShapeSize => {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { w: MAX_ASSET_EDGE, h: MAX_ASSET_EDGE };
  }

  const ratio = naturalWidth / naturalHeight;

  if (ratio >= 1) {
    return {
      w: MAX_ASSET_EDGE,
      h: Math.max(
        SHAPE_SIZE_STEP,
        Math.round(MAX_ASSET_EDGE / ratio / SHAPE_SIZE_STEP) * SHAPE_SIZE_STEP
      ),
    };
  }

  return {
    w: Math.max(
      SHAPE_SIZE_STEP,
      Math.round((MAX_ASSET_EDGE * ratio) / SHAPE_SIZE_STEP) * SHAPE_SIZE_STEP
    ),
    h: MAX_ASSET_EDGE,
  };
};
