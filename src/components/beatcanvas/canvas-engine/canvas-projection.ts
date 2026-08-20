import type {
  CanvasBounds,
  CanvasPoint,
  BeatCanvasFlowNode,
} from '../react-flow/beatcanvas-react-flow-types';
import { readNodeSize } from '../react-flow/beatcanvas-react-flow-types';

export const getAbsoluteNodePosition = (
  node: BeatCanvasFlowNode,
  nodesById: ReadonlyMap<string, BeatCanvasFlowNode>
): CanvasPoint => {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodesById.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }

  return { x, y };
};

export const getNodeBounds = (
  node: BeatCanvasFlowNode,
  nodesById: ReadonlyMap<string, BeatCanvasFlowNode>
): CanvasBounds => {
  const position = getAbsoluteNodePosition(node, nodesById);
  const size = readNodeSize(node);
  return {
    x: position.x,
    y: position.y,
    w: size.w,
    h: size.h,
    minX: position.x,
    minY: position.y,
    maxX: position.x + size.w,
    maxY: position.y + size.h,
    center: {
      x: position.x + size.w / 2,
      y: position.y + size.h / 2,
    },
  };
};

export const getUnionBounds = (
  bounds: CanvasBounds[]
): CanvasBounds | null => {
  if (bounds.length === 0) return null;
  const minX = Math.min(...bounds.map((item) => item.minX));
  const minY = Math.min(...bounds.map((item) => item.minY));
  const maxX = Math.max(...bounds.map((item) => item.maxX));
  const maxY = Math.max(...bounds.map((item) => item.maxY));
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
    center: {
      x: minX + (maxX - minX) / 2,
      y: minY + (maxY - minY) / 2,
    },
  };
};

export const buildReferenceEdgeId = (sourceId: string, targetId: string) =>
  `reference:${sourceId}:${targetId}`;
