import type { GenerationTake } from '@/core/beatcanvas/generation-history';
import type {
  Edge,
  Node,
  ReactFlowInstance,
  Viewport,
} from '@xyflow/react';

export const ASSET_CARD_NODE_TYPE = 'visugen-asset-card' as const;
export const GENERATION_CARD_NODE_TYPE = 'visugen-generation-card' as const;
export const WORKFLOW_GROUP_NODE_TYPE = 'visugen-workflow-group' as const;

export type BeatCanvasNodeType =
  | typeof ASSET_CARD_NODE_TYPE
  | typeof GENERATION_CARD_NODE_TYPE
  | typeof WORKFLOW_GROUP_NODE_TYPE;

export type BeatCanvasNodeMeta = Record<string, unknown>;

export type AssetCardNodeProps = {
  w: number;
  h: number;
  cardMediaType: 'image' | 'video';
  title: string;
  thumbnailUrl: string;
  fitMode: 'cover' | 'contain';
  chromeMode: 'default' | 'frameless';
};

export type GenerationCardNodeProps = {
  w: number;
  h: number;
  cardMediaType: 'image' | 'video';
  label: string;
  status: 'idle' | 'pending' | 'processing' | 'succeeded' | 'failed';
  isAnalysis?: boolean;
  latestOutputUrl?: string | null;
  latestOutputText?: string | null;
  takes?: GenerationTake[];
};

export type WorkflowGroupNodeProps = {
  w: number;
  h: number;
};

export type BeatCanvasNodeData = Record<string, unknown> & {
  meta: BeatCanvasNodeMeta;
  props:
    | AssetCardNodeProps
    | GenerationCardNodeProps
    | WorkflowGroupNodeProps;
};

export type BeatCanvasFlowNode = Node<BeatCanvasNodeData, BeatCanvasNodeType>;
export type BeatCanvasFlowEdge = Edge<Record<string, unknown>, 'visugen-reference'>;

export type CanvasPoint = { x: number; y: number };
export type CanvasBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  center: CanvasPoint;
};

export type CanvasShapeRecord = {
  id: string;
  type: string;
  x: number;
  y: number;
  parentId?: string;
  meta: BeatCanvasNodeMeta;
  props: Record<string, unknown>;
};

export type CanvasShapeInput = {
  id: string;
  type: string;
  x?: number;
  y?: number;
  parentId?: string;
  meta?: BeatCanvasNodeMeta;
  props?: Record<string, unknown>;
};

export type BeatCanvasEditor = {
  getContainer(): HTMLDivElement;
  getNodes(): BeatCanvasFlowNode[];
  getEdges(): BeatCanvasFlowEdge[];
  getShape(shapeId: string): CanvasShapeRecord | null;
  getCurrentPageShapes(): CanvasShapeRecord[];
  getSelectedShapeIds(): string[];
  getSortedChildIdsForParent(parentId: string): string[];
  getShapePageBounds(shapeId: string): CanvasBounds | null;
  getShapesAtPoint(point: CanvasPoint): CanvasShapeRecord[];
  getViewportPageBounds(): CanvasBounds;
  getZoomLevel(): number;
  getCamera(): { x: number; y: number; z: number };
  getCameraOptions(): { zoomSteps: number[] };
  setCameraOptions(options: { zoomSteps?: number[] }): void;
  screenToPage(point: CanvasPoint): CanvasPoint;
  pageToViewport(point: CanvasPoint): CanvasPoint;
  centerOnPoint(
    point: CanvasPoint,
    options?: { animation?: { duration: number }; zoom?: number }
  ): void;
  setCamera(
    camera: { x: number; y: number; z: number },
    options?: { animation?: { duration: number } }
  ): void;
  zoomIn(
    point?: CanvasPoint,
    options?: { animation?: { duration: number } }
  ): void;
  zoomOut(
    point?: CanvasPoint,
    options?: { animation?: { duration: number } }
  ): void;
  resetZoom(
    point?: CanvasPoint,
    options?: { animation?: { duration: number } }
  ): void;
  fitView(options?: { animation?: { duration: number } }): void;
  setEdgesVisible(visible: boolean): void;
  setSnapToGrid(enabled: boolean): void;
  isSnapToGridEnabled(): boolean;
  setCurrentTool(tool: string): void;
  select(shapeId: string): void;
  setSelectedShapes(shapeIds: string[]): void;
  createShape(shape: CanvasShapeInput): void;
  updateShape(shape: CanvasShapeInput): void;
  deleteShape(shapeId: string): void;
  deleteShapes(shapeIds: string[]): void;
  groupShapes(shapeIds: string[], options?: { groupId?: string }): void;
  bringToFront(shapeIds: string[]): void;
  createConnection(sourceId: string, targetId: string): void;
  deleteConnection(sourceId: string, targetId: string): void;
  setReactFlowInstance(instance: ReactFlowInstance<BeatCanvasFlowNode, BeatCanvasFlowEdge>): void;
  setViewportState(viewport: Viewport): void;
};

export const readNodeSize = (node: BeatCanvasFlowNode) => {
  const props = node.data.props;
  const width =
    typeof props.w === 'number'
      ? props.w
      : (node.measured?.width ?? node.width ?? 1);
  const height =
    typeof props.h === 'number'
      ? props.h
      : (node.measured?.height ?? node.height ?? 1);

  return {
    w: Math.max(1, width),
    h: Math.max(1, height),
  };
};

export const sortParentsBeforeChildren = (nodes: BeatCanvasFlowNode[]) => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node: BeatCanvasFlowNode) => {
    let depth = 0;
    let current = node;
    const visited = new Set<string>();
    while (current.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      depth += 1;
      current = parent;
    }
    return depth;
  };

  return [...nodes].sort((left, right) => depthOf(left) - depthOf(right));
};
