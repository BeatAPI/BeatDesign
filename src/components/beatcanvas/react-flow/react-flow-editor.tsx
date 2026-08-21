'use client';

import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import { CanvasEngineProvider } from '../canvas-engine/canvas-engine-context';
import {
  buildReferenceEdgeId,
  getNodeBounds,
  getUnionBounds,
} from '../canvas-engine/canvas-projection';
import { AssetCardNode } from '../nodes/asset-card-node';
import { GenerationCardNode } from '../nodes/generation-card-node';
import { WorkflowGroupNode } from '../nodes/workflow-group-node';
import { BeatCanvasReferenceEdge } from './beatcanvas-reference-edge';
import {
  ASSET_CARD_NODE_TYPE,
  GENERATION_CARD_NODE_TYPE,
  WORKFLOW_GROUP_NODE_TYPE,
  readNodeSize,
  sortParentsBeforeChildren,
  type CanvasBounds,
  type CanvasShapeInput,
  type CanvasShapeRecord,
  type BeatCanvasEditor,
  type BeatCanvasFlowEdge,
  type BeatCanvasFlowNode,
  type BeatCanvasNodeType,
} from './beatcanvas-react-flow-types';

import '@xyflow/react/dist/style.css';
import '@/styles/react-flow-beatcanvas.css';

type CanvasComponents = {
  InFrontOfTheCanvas?: ComponentType;
};

interface BeatCanvasReactFlowEditorProps {
  onMount?: (editor: unknown) => void;
  onDocumentChange?: () => void;
  onHistoryCheckpoint?: () => void;
  onShapeIdsRemoved?: (shapeIds: string[]) => void;
  onReferenceEdgesRemoved?: (
    edges: Array<{ source: string; target: string }>
  ) => void;
  components?: Record<string, unknown>;
}

const nodeTypes = {
  [ASSET_CARD_NODE_TYPE]: AssetCardNode,
  [GENERATION_CARD_NODE_TYPE]: GenerationCardNode,
  [WORKFLOW_GROUP_NODE_TYPE]: WorkflowGroupNode,
};

const edgeTypes = {
  'visugen-reference': BeatCanvasReferenceEdge,
};

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const DEFAULT_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const normalizeNodeType = (type: string): BeatCanvasNodeType | null => {
  if (type === ASSET_CARD_NODE_TYPE) return ASSET_CARD_NODE_TYPE;
  if (type === GENERATION_CARD_NODE_TYPE) return GENERATION_CARD_NODE_TYPE;
  if (type === WORKFLOW_GROUP_NODE_TYPE || type === 'group') {
    return WORKFLOW_GROUP_NODE_TYPE;
  }
  return null;
};

const shapeRecordFromNode = (node: BeatCanvasFlowNode): CanvasShapeRecord => ({
  id: node.id,
  type:
    node.type === WORKFLOW_GROUP_NODE_TYPE
      ? 'group'
      : (node.type ?? ASSET_CARD_NODE_TYPE),
  x: node.position.x,
  y: node.position.y,
  ...(node.parentId ? { parentId: node.parentId } : {}),
  meta: node.data.meta,
  props: node.data.props as Record<string, unknown>,
});

function BeatCanvasReactFlowCanvas({
  onMount,
  onDocumentChange,
  onHistoryCheckpoint,
  onShapeIdsRemoved,
  onReferenceEdgesRemoved,
  components,
}: BeatCanvasReactFlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<
    ReactFlowInstance<BeatCanvasFlowNode, BeatCanvasFlowEdge> | null
  >(null);
  const nodesRef = useRef<BeatCanvasFlowNode[]>([]);
  const edgesRef = useRef<BeatCanvasFlowEdge[]>([]);
  const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
  const zoomStepsRef = useRef(DEFAULT_ZOOM_STEPS);
  const mountedRef = useRef(false);
  const lastDeleteCheckpointAtRef = useRef(0);
  const isSnapToGridRef = useRef(false);
  const [nodes, setNodes] = useState<BeatCanvasFlowNode[]>([]);
  const [edges, setEdges] = useState<BeatCanvasFlowEdge[]>([]);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>(
    'select'
  );
  const [edgesVisible, setAreEdgesVisible] = useState(true);
  const [isSnapToGridEnabled, setIsSnapToGridEnabled] = useState(false);
  const [revision, setRevision] = useState(0);

  const notify = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  /**
   * A single delete keypress fans out into both onNodesChange and onEdgesChange
   * remove batches, so coalesce history checkpoints within a short window to
   * keep one undo entry per user action.
   */
  const checkpointForDelete = useCallback(() => {
    const now = Date.now();
    if (now - lastDeleteCheckpointAtRef.current < 80) return;
    lastDeleteCheckpointAtRef.current = now;
    onHistoryCheckpoint?.();
  }, [onHistoryCheckpoint]);

  const commitNodes = useCallback(
    (
      updater:
        | BeatCanvasFlowNode[]
        | ((current: BeatCanvasFlowNode[]) => BeatCanvasFlowNode[])
    ) => {
      const next =
        typeof updater === 'function' ? updater(nodesRef.current) : updater;
      const sorted = sortParentsBeforeChildren(next);
      nodesRef.current = sorted;
      setNodes(sorted);
      notify();
    },
    [notify]
  );

  const commitEdges = useCallback(
    (
      updater:
        | BeatCanvasFlowEdge[]
        | ((current: BeatCanvasFlowEdge[]) => BeatCanvasFlowEdge[])
    ) => {
      const next =
        typeof updater === 'function' ? updater(edgesRef.current) : updater;
      edgesRef.current = next;
      setEdges(next);
      notify();
    },
    [notify]
  );

  const editor = useMemo<BeatCanvasEditor>(() => {
    const getNode = (shapeId: string) =>
      nodesRef.current.find((node) => node.id === shapeId) ?? null;

    const getBounds = (shapeId: string): CanvasBounds | null => {
      const node = getNode(shapeId);
      if (!node) return null;
      return getNodeBounds(
        node,
        new Map(nodesRef.current.map((current) => [current.id, current]))
      );
    };

    const getViewportBounds = (): CanvasBounds => {
      const instance = instanceRef.current;
      const container = containerRef.current;
      if (!instance || !container) {
        return {
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 1,
          center: { x: 0.5, y: 0.5 },
        };
      }

      const rect = container.getBoundingClientRect();
      const topLeft = instance.screenToFlowPosition({
        x: rect.left,
        y: rect.top,
      });
      const bottomRight = instance.screenToFlowPosition({
        x: rect.right,
        y: rect.bottom,
      });
      return {
        x: topLeft.x,
        y: topLeft.y,
        w: bottomRight.x - topLeft.x,
        h: bottomRight.y - topLeft.y,
        minX: topLeft.x,
        minY: topLeft.y,
        maxX: bottomRight.x,
        maxY: bottomRight.y,
        center: {
          x: topLeft.x + (bottomRight.x - topLeft.x) / 2,
          y: topLeft.y + (bottomRight.y - topLeft.y) / 2,
        },
      };
    };

    const deleteIds = (shapeIds: string[]) => {
      const pending = new Set(shapeIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of nodesRef.current) {
          if (node.parentId && pending.has(node.parentId) && !pending.has(node.id)) {
            pending.add(node.id);
            changed = true;
          }
        }
      }

      commitNodes((current) =>
        current.filter((node) => !pending.has(node.id))
      );
      commitEdges((current) =>
        current.filter(
          (edge) => !pending.has(edge.source) && !pending.has(edge.target)
        )
      );
    };

    const api: BeatCanvasEditor = {
      getContainer() {
        if (!containerRef.current) {
          throw new Error('React Flow canvas is not mounted.');
        }
        return containerRef.current;
      },
      getNodes: () => nodesRef.current,
      getEdges: () => edgesRef.current,
      getShape(shapeId) {
        const node = getNode(shapeId);
        return node ? shapeRecordFromNode(node) : null;
      },
      getCurrentPageShapes() {
        return nodesRef.current.map(shapeRecordFromNode);
      },
      getSelectedShapeIds() {
        return nodesRef.current
          .filter((node) => node.selected)
          .map((node) => node.id);
      },
      getSortedChildIdsForParent(parentId) {
        return nodesRef.current
          .filter((node) => node.parentId === parentId)
          .sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0))
          .map((node) => node.id);
      },
      getShapePageBounds: getBounds,
      getShapesAtPoint(point) {
        return nodesRef.current
          .filter((node) => {
            const bounds = getBounds(node.id);
            return Boolean(
              bounds &&
                point.x >= bounds.minX &&
                point.x <= bounds.maxX &&
                point.y >= bounds.minY &&
                point.y <= bounds.maxY
            );
          })
          .sort((left, right) => (right.zIndex ?? 0) - (left.zIndex ?? 0))
          .map(shapeRecordFromNode);
      },
      getViewportPageBounds: getViewportBounds,
      getZoomLevel() {
        return viewportRef.current.zoom;
      },
      getCamera() {
        const viewport = viewportRef.current;
        return {
          x: -viewport.x / viewport.zoom,
          y: -viewport.y / viewport.zoom,
          z: viewport.zoom,
        };
      },
      getCameraOptions() {
        return { zoomSteps: zoomStepsRef.current };
      },
      setCameraOptions(options) {
        if (options.zoomSteps) zoomStepsRef.current = options.zoomSteps;
      },
      screenToPage(point) {
        return instanceRef.current?.screenToFlowPosition(point) ?? point;
      },
      pageToViewport(point) {
        const instance = instanceRef.current;
        const container = containerRef.current;
        if (!instance || !container) return point;
        const screenPoint = instance.flowToScreenPosition(point);
        const rect = container.getBoundingClientRect();
        return {
          x: screenPoint.x - rect.left,
          y: screenPoint.y - rect.top,
        };
      },
      centerOnPoint(point, options) {
        void instanceRef.current?.setCenter(point.x, point.y, {
          zoom: options?.zoom ?? viewportRef.current.zoom,
          duration: options?.animation?.duration ?? 0,
        });
      },
      setCamera(camera, options) {
        void instanceRef.current?.setViewport(
          {
            x: -camera.x * camera.z,
            y: -camera.y * camera.z,
            zoom: camera.z,
          },
          { duration: options?.animation?.duration ?? 0 }
        );
      },
      zoomIn(_point, options) {
        void instanceRef.current?.zoomIn({
          duration: options?.animation?.duration ?? 0,
        });
      },
      zoomOut(_point, options) {
        void instanceRef.current?.zoomOut({
          duration: options?.animation?.duration ?? 0,
        });
      },
      resetZoom(_point, options) {
        void instanceRef.current?.zoomTo(1, {
          duration: options?.animation?.duration ?? 0,
        });
      },
      fitView(options) {
        void instanceRef.current?.fitView({
          padding: 0.18,
          duration: options?.animation?.duration ?? 0,
        });
      },
      setEdgesVisible(visible) {
        setAreEdgesVisible(visible);
      },
      setSnapToGrid(enabled) {
        isSnapToGridRef.current = enabled;
        setIsSnapToGridEnabled(enabled);
      },
      isSnapToGridEnabled() {
        return isSnapToGridRef.current;
      },
      setCurrentTool(tool) {
        setInteractionMode(tool === 'pan' || tool === 'hand' ? 'pan' : 'select');
      },
      select(shapeId) {
        api.setSelectedShapes([shapeId]);
      },
      setSelectedShapes(shapeIds) {
        const selected = new Set(shapeIds);
        commitNodes((current) =>
          current.map((node) => ({
            ...node,
            selected: selected.has(node.id),
          }))
        );
      },
      createShape(shape: CanvasShapeInput) {
        const type = normalizeNodeType(shape.type);
        if (!type) return;
        const existing = getNode(shape.id);
        const nextProps = {
          ...(existing?.data.props ?? {}),
          ...(shape.props ?? {}),
        };
        const nextNode: BeatCanvasFlowNode = {
          ...(existing ?? {
            id: shape.id,
            type,
            position: { x: shape.x ?? 0, y: shape.y ?? 0 },
            data: { meta: {}, props: { w: 1, h: 1 } },
          }),
          id: shape.id,
          type,
          position: {
            x: shape.x ?? existing?.position.x ?? 0,
            y: shape.y ?? existing?.position.y ?? 0,
          },
          ...(shape.parentId
            ? { parentId: shape.parentId, extent: 'parent' as const }
            : existing?.parentId
              ? {
                  parentId: existing.parentId,
                  extent: existing.extent,
                }
              : {}),
          data: {
            meta: {
              ...(existing?.data.meta ?? {}),
              ...(shape.meta ?? {}),
            },
            props: nextProps as BeatCanvasFlowNode['data']['props'],
          },
          style: {
            ...(existing?.style ?? {}),
            width:
              typeof nextProps.w === 'number'
                ? nextProps.w
                : existing?.style?.width,
            height:
              typeof nextProps.h === 'number'
                ? nextProps.h
                : existing?.style?.height,
          },
        };
        commitNodes((current) => [
          ...current.filter((node) => node.id !== shape.id),
          nextNode,
        ]);
      },
      updateShape(shape) {
        api.createShape(shape);
      },
      deleteShape(shapeId) {
        deleteIds([shapeId]);
      },
      deleteShapes(shapeIds) {
        deleteIds(shapeIds);
      },
      groupShapes(shapeIds, options) {
        const uniqueIds = Array.from(new Set(shapeIds));
        const selectedNodes = uniqueIds
          .map((shapeId) => getNode(shapeId))
          .filter((node): node is BeatCanvasFlowNode => Boolean(node));
        if (selectedNodes.length < 2) return;

        const byId = new Map(
          nodesRef.current.map((node) => [node.id, node] as const)
        );
        const union = getUnionBounds(
          selectedNodes.map((node) => getNodeBounds(node, byId))
        );
        if (!union) return;

        const groupId =
          options?.groupId ??
          `shape:group:${Math.random().toString(36).slice(2, 10)}`;
        const groupNode: BeatCanvasFlowNode = {
          id: groupId,
          type: WORKFLOW_GROUP_NODE_TYPE,
          position: { x: union.x, y: union.y },
          data: {
            meta: {},
            props: { w: union.w, h: union.h },
          },
          style: { width: union.w, height: union.h },
          zIndex: Math.min(...selectedNodes.map((node) => node.zIndex ?? 0)) - 1,
        };

        const groupedIds = new Set(selectedNodes.map((node) => node.id));
        const nextNodes = nodesRef.current.map((node) => {
          if (!groupedIds.has(node.id)) return node;
          const absolute = getNodeBounds(node, byId);
          return {
            ...node,
            parentId: groupId,
            extent: 'parent' as const,
            position: {
              x: absolute.x - union.x,
              y: absolute.y - union.y,
            },
          };
        });
        commitNodes([groupNode, ...nextNodes]);
      },
      bringToFront(shapeIds) {
        const ids = new Set(shapeIds);
        const maxZ = Math.max(
          0,
          ...nodesRef.current.map((node) => node.zIndex ?? 0)
        );
        let offset = 1;
        commitNodes((current) =>
          current.map((node) =>
            ids.has(node.id)
              ? { ...node, zIndex: maxZ + offset++ }
              : node
          )
        );
      },
      createConnection(sourceId, targetId) {
        if (!getNode(sourceId) || !getNode(targetId) || sourceId === targetId) {
          return;
        }
        const id = buildReferenceEdgeId(sourceId, targetId);
        if (edgesRef.current.some((edge) => edge.id === id)) return;
        commitEdges((current) => [
          ...current,
          {
            id,
            source: sourceId,
            target: targetId,
            type: 'visugen-reference',
            selectable: true,
            deletable: true,
          },
        ]);
      },
      deleteConnection(sourceId, targetId) {
        const id = buildReferenceEdgeId(sourceId, targetId);
        commitEdges((current) => current.filter((edge) => edge.id !== id));
      },
      setReactFlowInstance(instance) {
        instanceRef.current = instance;
      },
      setViewportState(viewport) {
        viewportRef.current = viewport;
        notify();
      },
    };

    return api;
  }, [commitEdges, commitNodes, notify]);

  const onNodesChange = useCallback(
    (changes: NodeChange<BeatCanvasFlowNode>[]) => {
      const hasRemovals = changes.some((change) => change.type === 'remove');
      if (hasRemovals) {
        checkpointForDelete();
      }
      const directlyRemovedIds = new Set(
        changes
          .filter(
            (
              change
            ): change is Extract<
              NodeChange<BeatCanvasFlowNode>,
              { type: 'remove' }
            > => change.type === 'remove'
          )
          .map((change) => change.id)
      );
      const removedIds = new Set(directlyRemovedIds);
      let foundDescendant = true;
      while (foundDescendant) {
        foundDescendant = false;
        for (const node of nodesRef.current) {
          if (
            node.parentId &&
            removedIds.has(node.parentId) &&
            !removedIds.has(node.id)
          ) {
            removedIds.add(node.id);
            foundDescendant = true;
          }
        }
      }

      const nonRemoveChanges = changes.filter(
        (change) => change.type !== 'remove'
      );
      if (removedIds.size > 0) {
        onShapeIdsRemoved?.([...removedIds]);
      }
      let nextNodes = applyNodeChanges(
        nonRemoveChanges,
        nodesRef.current.filter((node) => !removedIds.has(node.id))
      );
      const dimensions = new Map(
        changes
          .filter(
            (
              change
            ): change is Extract<
              NodeChange<BeatCanvasFlowNode>,
              { type: 'dimensions' }
            > => change.type === 'dimensions' && Boolean(change.dimensions)
          )
          .map((change) => [change.id, change.dimensions!])
      );

      if (dimensions.size > 0) {
        nextNodes = nextNodes.map((node) => {
          const size = dimensions.get(node.id);
          if (!size) return node;
          return {
            ...node,
            data: {
              ...node.data,
              props: {
                ...node.data.props,
                w: size.width,
                h: size.height,
              },
            },
            style: {
              ...node.style,
              width: size.width,
              height: size.height,
            },
          };
        });
      }

      const availableIds = new Set(nextNodes.map((node) => node.id));
      commitNodes(nextNodes);
      commitEdges((current) =>
        current.filter(
          (edge) =>
            availableIds.has(edge.source) && availableIds.has(edge.target)
        )
      );
    },
    [checkpointForDelete, commitEdges, commitNodes, onShapeIdsRemoved]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<BeatCanvasFlowEdge>[]) => {
      const removedEdgeIds = new Set(
        changes
          .filter(
            (change): change is Extract<EdgeChange<BeatCanvasFlowEdge>, { type: 'remove' }> =>
              change.type === 'remove'
          )
          .map((change) => change.id)
      );

      if (removedEdgeIds.size > 0) {
        checkpointForDelete();
      }

      const removedEdges = edgesRef.current.filter((edge) =>
        removedEdgeIds.has(edge.id)
      );

      commitEdges(applyEdgeChanges(changes, edgesRef.current));

      if (removedEdges.length > 0) {
        onReferenceEdgesRemoved?.(
          removedEdges.map((edge) => ({
            source: edge.source,
            target: edge.target,
          }))
        );
      }
    },
    [checkpointForDelete, commitEdges, onReferenceEdgesRemoved]
  );

  const handleNodeDragStop = useCallback(() => {
    onDocumentChange?.();
  }, [onDocumentChange]);

  const handleNodeDragStart = useCallback(() => {
    onHistoryCheckpoint?.();
  }, [onHistoryCheckpoint]);

  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      editor.setViewportState(viewport);
      onDocumentChange?.();
    },
    [editor, onDocumentChange]
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance<BeatCanvasFlowNode, BeatCanvasFlowEdge>) => {
      editor.setReactFlowInstance(instance);
      viewportRef.current = instance.getViewport();
      if (!mountedRef.current) {
        mountedRef.current = true;
        onMount?.(editor);
      }
      notify();
    },
    [editor, notify, onMount]
  );

  const FrontLayer = (components as CanvasComponents | undefined)
    ?.InFrontOfTheCanvas;

  const lineagePresentation = useMemo(() => {
    const selectedIds = nodes
      .filter((node) => node.selected)
      .map((node) => node.id);
    if (selectedIds.length !== 1) {
      return {
        nodes,
        edges: edgesVisible ? edges : [],
      };
    }

    const selectedId = selectedIds[0];
    const upstream = new Set<string>();
    const downstream = new Set<string>();
    const collect = (
      startId: string,
      direction: 'upstream' | 'downstream',
      target: Set<string>
    ) => {
      const queue = [startId];
      const visited = new Set(queue);
      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) continue;
        for (const edge of edges) {
          const nextId =
            direction === 'upstream' && edge.target === currentId
              ? edge.source
              : direction === 'downstream' && edge.source === currentId
                ? edge.target
                : null;
          if (!nextId || visited.has(nextId)) continue;
          visited.add(nextId);
          target.add(nextId);
          queue.push(nextId);
        }
      }
    };

    collect(selectedId, 'upstream', upstream);
    collect(selectedId, 'downstream', downstream);
    const related = new Set([selectedId, ...upstream, ...downstream]);

    return {
      nodes: nodes.map((node) => {
        const role =
          node.id === selectedId
            ? 'selected'
            : upstream.has(node.id)
              ? 'upstream'
              : downstream.has(node.id)
                ? 'downstream'
                : 'dimmed';
        return {
          ...node,
          style: {
            ...node.style,
            opacity: related.has(node.id) ? 1 : 0.24,
            filter:
              role === 'upstream'
                ? 'drop-shadow(0 0 10px rgba(127,176,242,0.42))'
                : role === 'downstream'
                  ? 'drop-shadow(0 0 10px rgba(255,122,51,0.34))'
                  : node.style?.filter,
            transition: 'opacity 160ms ease, filter 160ms ease',
          },
          data: {
            ...node.data,
            meta: {
              ...node.data.meta,
              visugenLineageRole: role,
            },
          },
        };
      }),
      edges: edgesVisible
        ? edges.map((edge) => {
            const isUpstream =
              upstream.has(edge.source) &&
              (upstream.has(edge.target) || edge.target === selectedId);
            const isDownstream =
              downstream.has(edge.target) &&
              (downstream.has(edge.source) || edge.source === selectedId);
            return {
              ...edge,
              data: {
                ...edge.data,
                visugenLineageRole: isUpstream
                  ? 'upstream'
                  : isDownstream
                    ? 'downstream'
                    : 'dimmed',
              },
            };
          })
        : [],
    };
  }, [edges, edgesVisible, nodes]);

  return (
    <CanvasEngineProvider editor={editor} revision={revision}>
      <div
        ref={containerRef}
        className="beatcanvas-react-flow absolute inset-0 overflow-hidden"
      >
        <ReactFlow<BeatCanvasFlowNode, BeatCanvasFlowEdge>
          nodes={lineagePresentation.nodes}
          edges={lineagePresentation.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={handleInit}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onMove={(_event, viewport) => editor.setViewportState(viewport)}
          onMoveEnd={handleMoveEnd}
          minZoom={0.1}
          maxZoom={4}
          defaultViewport={DEFAULT_VIEWPORT}
          selectionOnDrag={interactionMode === 'select'}
          selectionMode={SelectionMode.Partial}
          panOnDrag={interactionMode === 'pan' ? [0, 1, 2] : [1, 2]}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          nodesDraggable={interactionMode === 'select'}
          nodesConnectable={false}
          edgesFocusable
          snapToGrid={isSnapToGridEnabled}
          snapGrid={[24, 24]}
          deleteKeyCode={['Backspace', 'Delete']}
          elevateNodesOnSelect
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
        >
          <Background
            id="visugen-minor-dots"
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.3}
            color="rgba(224, 226, 232, 0.24)"
          />
          <Background
            id="visugen-major-dots"
            variant={BackgroundVariant.Dots}
            gap={96}
            size={1.8}
            color="rgba(127, 176, 242, 0.3)"
          />
          {nodes.length > 0 ? (
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor="rgba(127, 176, 242, 0.55)"
              nodeStrokeColor="rgba(255, 255, 255, 0.16)"
              nodeStrokeWidth={1}
              maskColor="rgba(10, 10, 11, 0.66)"
            />
          ) : null}
        </ReactFlow>
        {FrontLayer ? <FrontLayer /> : null}
      </div>
    </CanvasEngineProvider>
  );
}

export default function BeatCanvasReactFlowEditor(
  props: BeatCanvasReactFlowEditorProps
) {
  return (
    <ReactFlowProvider>
      <BeatCanvasReactFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
