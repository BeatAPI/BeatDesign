import {
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport,
  type NodeProps,
  type EdgeProps,
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
import { TextCardNode } from '../nodes/text-card-node';
import { GenerationCardNode } from '../nodes/generation-card-node';
import { WorkflowGroupNode } from '../nodes/workflow-group-node';
import { getBeatCanvasNodeCopy } from '../nodes/beatcanvas-node-copy';
import { BeatCanvasReferenceEdge } from './beatcanvas-reference-edge';
import { projectCanvasOrganization } from '@/core/organization/canvas-projection';
import {
  applyCanvasOrganizationOperations,
  cleanupCanvasOrganizationForRemovedCards,
  type CanvasOrganization,
  type CanvasOrganizationOperation,
} from '@/core/organization/canvas-organization';
import { toast } from 'sonner';
import type {
  CanvasCard,
  CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import {
  resolveConcreteCanvasMediaCard,
  resolvePinnedGenerationOutputId,
} from '@/core/beatcanvas/generation-history';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import type {
  ProjectSnapshotDocument,
  ProjectSnapshotShapeFrame,
} from '@/core/projects/project-snapshot';
import {
  ASSET_CARD_NODE_TYPE,
  TEXT_CARD_NODE_TYPE,
  GENERATION_CARD_NODE_TYPE,
  WORKFLOW_GROUP_NODE_TYPE,
  readNodeSize,
  sortParentsBeforeChildren,
  countGroupTimelineUses,
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
  organization?: CanvasOrganization;
  canvasCards?: Record<string, CanvasCard>;
  timelineUsage?: Array<{ assetId: string | null }>;
  getCanvasDocument?: () => ProjectSnapshotDocument;
  onOrganizationChange?: (
    organization: CanvasOrganization,
    frames?: Record<string, ProjectSnapshotShapeFrame>
  ) => void;
  onMount?: (editor: unknown) => void;
  onDocumentChange?: () => void;
  onHistoryCheckpoint?: () => void;
  onShapeIdsRemoved?: (shapeIds: string[]) => void;
  onReferenceEdgesRemoved?: (
    edges: Array<{ source: string; target: string }>
  ) => void;
  components?: Record<string, unknown>;
}

function OrganizationGroupNode(props: NodeProps<BeatCanvasFlowNode>) {
  const t = useTranslations('Organization');
  if (!props.data.meta.beatdesignOrganizationGroup)
    return <WorkflowGroupNode {...props} />;
  const meta = props.data.meta;
  const collapsed = Boolean(meta.collapsed);
  const counts = meta.statuses as Record<string, number> | undefined;
  const copy = getBeatCanvasNodeCopy();
  return (
    <>
      <NodeResizer
        isVisible={Boolean(props.selected)}
        minWidth={120}
        minHeight={72}
        onResizeStart={() =>
          (meta.onCheckpoint as (() => void) | undefined)?.()
        }
      />
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!opacity-0"
      />
      <div
        data-organization-group={props.id}
        style={{
          width: props.data.props.w,
          height: props.data.props.h,
          border: `1px ${collapsed ? 'solid' : 'dashed'} ${props.selected ? 'var(--beat-graph)' : 'rgba(220,226,235,.25)'}`,
          borderRadius: 12,
          background: collapsed
            ? 'var(--beat-surface)'
            : 'rgba(127,176,242,.025)',
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        <button
          data-group-header
          className="nodrag nopan flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold text-[var(--beat-text-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--beat-graph)]"
          aria-expanded={!collapsed}
          onClick={() => (meta.onToggle as (() => void) | undefined)?.()}
        >
          <span aria-hidden>{collapsed ? '▸' : '▾'}</span>
          <span className="min-w-0 flex-1 truncate">
            {String(meta.name ?? '')}
          </span>
          <span className="text-xs opacity-60">
            {Number(meta.memberCount ?? 0)}
          </span>
        </button>
        {!collapsed ? (
          <div
            className="nodrag nopan mt-1 flex gap-1"
            role="group"
            aria-label={t('groupLayout')}
          >
            {(['tidy', 'row', 'column', 'fit'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className="min-h-11 flex-1 rounded border border-white/10 px-1 text-xs hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--beat-graph)]"
                onClick={() =>
                  (meta.onLayout as ((mode: string) => void) | undefined)?.(
                    mode
                  )
                }
              >
                {t(`layout_${mode}`)}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-3 text-xs text-[var(--beat-text-2)]">
              <span aria-label={copy.processing}>
                ◌{' '}
                {Number(counts?.pending ?? 0) + Number(counts?.processing ?? 0)}
              </span>
              <span aria-label={copy.generationFailed}>
                ⚠ {Number(counts?.failed ?? 0)}
              </span>
            </div>
            {meta.resultName ? (
              <div className="mt-2 text-xs">
                <p className="text-[var(--beat-text-2)]">
                  {t('displayedResult')}
                </p>
                <button
                  className="nodrag nopan block min-h-11 w-full truncate text-left text-[var(--beat-text-1)] underline underline-offset-2"
                  onClick={() =>
                    (meta.onResult as (() => void) | undefined)?.()
                  }
                >
                  {String(meta.resultName)}
                </button>
              </div>
            ) : null}
            <p className="mt-1 text-xs text-[var(--beat-text-2)]">
              {t('timelineUses', {
                count:
                  meta.timelineUseCount == null
                    ? '—'
                    : Number(meta.timelineUseCount),
              })}
            </p>
            <p className="mt-1 text-xs text-[var(--beat-text-2)]">
              {t('reviewNotRecorded')}
            </p>
          </>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!opacity-0"
      />
    </>
  );
}

function OrganizationReferenceEdge(props: EdgeProps<BeatCanvasFlowEdge>) {
  const count = Number(props.data?.referenceCount ?? 0);
  const references = props.data?.organizationReferences as
    | Array<{ sourceCardId: string; targetCardId: string }>
    | undefined;
  return (
    <>
      <BeatCanvasReferenceEdge {...props} />
      {count > 1 ? (
        <text
          x={(props.sourceX + props.targetX) / 2}
          y={(props.sourceY + props.targetY) / 2 - 6}
          fill="var(--beat-text-1)"
          fontSize={12}
          textAnchor="middle"
        >
          <title>
            {references
              ?.map(
                (reference) =>
                  `${reference.sourceCardId} → ${reference.targetCardId}`
              )
              .join('\n')}
          </title>
          {count}
        </text>
      ) : null}
    </>
  );
}

const nodeTypes = {
  [TEXT_CARD_NODE_TYPE]: TextCardNode,
  [ASSET_CARD_NODE_TYPE]: AssetCardNode,
  [GENERATION_CARD_NODE_TYPE]: GenerationCardNode,
  [WORKFLOW_GROUP_NODE_TYPE]: OrganizationGroupNode,
};

const edgeTypes = {
  'beatdesign-reference': OrganizationReferenceEdge,
};

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const DEFAULT_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const normalizeNodeType = (type: string): BeatCanvasNodeType | null => {
  if (type === TEXT_CARD_NODE_TYPE) return TEXT_CARD_NODE_TYPE;
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
  organization,
  canvasCards,
  timelineUsage,
  getCanvasDocument,
  onOrganizationChange,
  onMount,
  onDocumentChange,
  onHistoryCheckpoint,
  onShapeIdsRemoved,
  onReferenceEdgesRemoved,
  components,
}: BeatCanvasReactFlowEditorProps) {
  const organizationT = useTranslations('Organization');
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
  const organizationRef = useRef(organization);
  const displayedGroupFramesRef = useRef<
    Record<string, { x: number; y: number; w: number; h: number }>
  >({});
  organizationRef.current = organization;
  const cardsRef = useRef(canvasCards);
  cardsRef.current = canvasCards;
  const getCanvasDocumentRef = useRef(getCanvasDocument);
  getCanvasDocumentRef.current = getCanvasDocument;
  const onOrganizationChangeRef = useRef(onOrganizationChange);
  onOrganizationChangeRef.current = onOrganizationChange;
  const selectedGroupIdsRef = useRef<Set<string>>(new Set());
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
      if (
        sorted.length === nodesRef.current.length &&
        sorted.every((node, index) => node === nodesRef.current[index])
      )
        return;
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
      if (
        next.length === edgesRef.current.length &&
        next.every((edge, index) => edge === edgesRef.current[index])
      )
        return;
      edgesRef.current = next;
      setEdges(next);
      notify();
    },
    [notify]
  );

  const applyOrganizationChange = useCallback(
    (operations: CanvasOrganizationOperation[]) => {
      const byId = new Map(nodesRef.current.map((node) => [node.id, node]));
      const fallbackFrames = Object.fromEntries(
        nodesRef.current.map((node) => {
          const bounds = getNodeBounds(node, byId);
          return [
            node.id,
            { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
          ];
        })
      );
      const source = getCanvasDocumentRef.current?.() ?? {
        version: 4 as const,
        cards: Object.values(cardsRef.current ?? {}),
        frames: fallbackFrames,
      };
      let result: ReturnType<typeof applyCanvasOrganizationOperations>;
      try {
        result = applyCanvasOrganizationOperations(
          { ...source, organization: organizationRef.current },
          operations
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
        notify();
        return;
      }
      organizationRef.current = result.document.organization;
      onOrganizationChangeRef.current?.(
        result.document.organization,
        result.document.frames
      );
      commitNodes((current) =>
        current.map((node) => {
          const frame = result.document.frames[node.id];
          return frame
            ? {
                ...node,
                parentId: undefined,
                extent: undefined,
                position: { x: frame.x, y: frame.y },
              }
            : node;
        })
      );
      onDocumentChange?.();
    },
    [commitNodes, notify, onDocumentChange]
  );

  const editor = useMemo<BeatCanvasEditor>(() => {
    const getNode = (shapeId: string) =>
      nodesRef.current.find((node) => node.id === shapeId) ?? null;

    const getBounds = (shapeId: string): CanvasBounds | null => {
      const node = getNode(shapeId);
      if (!node) {
        const group = organizationRef.current?.groups[shapeId];
        if (!group) return null;
        const frame =
          displayedGroupFramesRef.current[shapeId] ??
          (group.collapsed ? group.summaryFrame : group.expandedFrame);
        return {
          ...frame,
          minX: frame.x,
          minY: frame.y,
          maxX: frame.x + frame.w,
          maxY: frame.y + frame.h,
          center: { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 },
        };
      }
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
      const groupIds = shapeIds.filter((id) =>
        Boolean(organizationRef.current?.groups[id])
      );
      if (groupIds.length)
        applyOrganizationChange(
          groupIds.map((groupId) => ({ type: 'remove_group', groupId }))
        );
      const pending = new Set(shapeIds.filter((id) => !groupIds.includes(id)));
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
        if (node) return shapeRecordFromNode(node);
        const group = organizationRef.current?.groups[shapeId];
        const frame =
          group &&
          (displayedGroupFramesRef.current[shapeId] ??
            (group.collapsed ? group.summaryFrame : group.expandedFrame));
        return group && frame
          ? {
              id: group.id,
              type: 'group',
              x: frame.x,
              y: frame.y,
              meta: { beatdesignOrganizationGroup: true },
              props: { w: frame.w, h: frame.h },
            }
          : null;
      },
      getCurrentPageShapes() {
        return nodesRef.current.map(shapeRecordFromNode);
      },
      getSelectedShapeIds() {
        return [
          ...nodesRef.current
            .filter((node) => node.selected)
            .map((node) => node.id),
          ...selectedGroupIdsRef.current,
        ];
      },
      getSortedChildIdsForParent(parentId) {
        const group = organizationRef.current?.groups[parentId];
        if (group) return [...group.memberCardIds];
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
        selectedGroupIdsRef.current = new Set(
          shapeIds.filter((id) => Boolean(organizationRef.current?.groups[id]))
        );
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
            type: 'beatdesign-reference',
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
        const previous = viewportRef.current;
        if (
          previous.x === viewport.x &&
          previous.y === viewport.y &&
          previous.zoom === viewport.zoom
        )
          return;
        viewportRef.current = viewport;
        notify();
      },
    };

    return api;
  }, [applyOrganizationChange, commitEdges, commitNodes, notify]);

  const onNodesChange = useCallback(
    (changes: NodeChange<BeatCanvasFlowNode>[]) => {
      let groupSelectionChanged = false;
      const groupChanges = changes.filter(
        (change) =>
          'id' in change && Boolean(organizationRef.current?.groups[change.id])
      );
      for (const change of groupChanges) {
        if (!('id' in change)) continue;
        const group = organizationRef.current?.groups[change.id];
        if (!group) continue;
        if (change.type === 'select') {
          if (selectedGroupIdsRef.current.has(change.id) === change.selected)
            continue;
          groupSelectionChanged = true;
          if (change.selected) selectedGroupIdsRef.current.add(change.id);
          else selectedGroupIdsRef.current.delete(change.id);
        } else if (change.type === 'remove') {
          checkpointForDelete();
          applyOrganizationChange([
            { type: 'remove_group', groupId: group.id },
          ]);
          selectedGroupIdsRef.current.delete(group.id);
        } else if (
          change.type === 'position' &&
          change.position &&
          change.dragging !== undefined
        ) {
          const frame =
            displayedGroupFramesRef.current[group.id] ??
            (group.collapsed ? group.summaryFrame : group.expandedFrame);
          const deltaX = change.position.x - frame.x;
          const deltaY = change.position.y - frame.y;
          if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001)
            applyOrganizationChange([
              { type: 'move_group', groupId: group.id, deltaX, deltaY },
            ]);
        } else if (
          change.type === 'dimensions' &&
          change.dimensions &&
          change.resizing !== undefined
        ) {
          const frame =
            displayedGroupFramesRef.current[group.id] ??
            (group.collapsed ? group.summaryFrame : group.expandedFrame);
          const resizePosition = groupChanges.find(
            (candidate) =>
              candidate.type === 'position' &&
              candidate.id === group.id &&
              candidate.dragging === undefined
          );
          const position =
            resizePosition?.type === 'position'
              ? resizePosition.position
              : undefined;
          if (
            Math.abs(frame.w - change.dimensions.width) > 0.001 ||
            Math.abs(frame.h - change.dimensions.height) > 0.001 ||
            (position &&
              (Math.abs(frame.x - position.x) > 0.001 ||
                Math.abs(frame.y - position.y) > 0.001))
          )
            applyOrganizationChange([
              {
                type: 'resize_group',
                groupId: group.id,
                target: group.collapsed ? 'summary' : 'expanded',
                frame: {
                  ...frame,
                  ...(position ? { x: position.x, y: position.y } : {}),
                  w: change.dimensions.width,
                  h: change.dimensions.height,
                },
              },
            ]);
        }
      }
      changes = changes.filter((change) => !groupChanges.includes(change));
      // React Flow measures synthetic groups too. Their initial measurement is
      // presentation only: publishing an unchanged canonical graph here creates
      // a render → ResizeObserver → revision → render feedback loop.
      changes = changes.filter((change) => {
        if (!('id' in change)) return true;
        const node = nodesRef.current.find((node) => node.id === change.id);
        if (!node) return change.type === 'replace';
        if (change.type === 'select')
          return Boolean(node.selected) !== change.selected;
        if (change.type === 'dimensions' && change.dimensions)
          return (
            !node.measured?.width ||
            !node.measured?.height ||
            Math.abs(node.data.props.w - change.dimensions.width) > 0.001 ||
            Math.abs(node.data.props.h - change.dimensions.height) > 0.001 ||
            Boolean(change.resizing) !== Boolean(node.resizing)
          );
        return true;
      });
      if (groupSelectionChanged) notify();
      if (!changes.length) return;
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
    [
      applyOrganizationChange,
      checkpointForDelete,
      commitEdges,
      commitNodes,
      notify,
      onShapeIdsRemoved,
    ]
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

  const displayGraph = useMemo(() => {
    if (!organization || !canvasCards)
      return {
        nodes,
        edges,
        historyGroups: [] as Array<{
          generationCardId: string;
          outputCardIds: string[];
        }>,
      };
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const frames = Object.fromEntries(
      nodes.map((node) => {
        const bounds = getNodeBounds(node, byId);
        return [
          node.id,
          { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
        ];
      })
    );
    const selectedCardId = nodes.find((node) => node.selected)?.id;
    const selectedGroupId =
      [...selectedGroupIdsRef.current][0] ??
      Object.values(organization.groups).find(
        (group) =>
          selectedCardId && group.memberCardIds.includes(selectedCardId)
      )?.id ??
      null;
    const known = new Set(Object.keys(canvasCards));
    const metadataIds = [
      ...Object.values(organization.groups).flatMap(
        (group) => group.memberCardIds
      ),
      ...Object.values(organization.elementBindings).flatMap((binding) => [
        binding.consumerCardId,
        binding.referenceCardId,
      ]),
      ...Object.values(organization.templateInstances).flatMap((instance) => [
        ...Object.values(instance.stepCardIds),
        ...Object.values(instance.slotBindings).map(
          (binding) => binding.referenceCardId
        ),
      ]),
    ];
    const cleanDocument = cleanupCanvasOrganizationForRemovedCards(
      { cards: Object.values(canvasCards), frames, organization },
      metadataIds.filter((id) => !known.has(id))
    );
    const projection = projectCanvasOrganization(cleanDocument, {
      selectedGroupId,
    });
    displayedGroupFramesRef.current = Object.fromEntries(
      projection.nodes
        .filter((node) => node.kind === 'group')
        .map((node) => [node.id, node.frame!])
    );
    const visible = new Set(
      projection.nodes
        .filter((node) => node.kind === 'card')
        .map((node) => node.id)
    );
    const real = nodes
      .filter((node) => visible.has(node.id))
      .map((node) => ({ ...node, zIndex: Math.max(1, node.zIndex ?? 0) }));
    const groups: BeatCanvasFlowNode[] = projection.nodes
      .filter((node) => node.kind === 'group')
      .map((node) => {
        const group = cleanDocument.organization.groups[node.id];
        const frame = node.frame!;
        const result = group.resultCardId
          ? canvasCards[group.resultCardId]
          : undefined;
        return {
          id: node.id,
          type: WORKFLOW_GROUP_NODE_TYPE,
          position: { x: frame.x, y: frame.y },
          selected: selectedGroupIdsRef.current.has(node.id),
          zIndex: 0,
          width: frame.w,
          height: frame.h,
          measured: { width: frame.w, height: frame.h },
          style: { width: frame.w, height: frame.h },
          data: {
            props: { w: frame.w, h: frame.h },
            meta: {
              beatdesignOrganizationGroup: true,
              name: group.name,
              collapsed: group.collapsed,
              memberCount: node.memberCount,
              statuses: node.statuses,
              resultName: result?.name,
              timelineUseCount: timelineUsage
                ? countGroupTimelineUses(
                    Object.values(canvasCards),
                    group.memberCardIds,
                    timelineUsage
                  )
                : null,
              onResult: () => {
                onHistoryCheckpoint?.();
                applyOrganizationChange([
                  {
                    type: 'set_group_collapsed',
                    groupId: node.id,
                    collapsed: false,
                  },
                ]);
                const concrete = resolveConcreteCanvasMediaCard({
                  cards: canvasCards,
                  card: result,
                });
                if (
                  concrete?.url &&
                  (concrete.type === 'image' || concrete.type === 'video')
                ) {
                  window.dispatchEvent(
                    new CustomEvent('beatcanvas:preview-media', {
                      detail: {
                        type: concrete.type,
                        url: concrete.url,
                        title: concrete.name,
                      },
                    })
                  );
                } else if (result) {
                  requestAnimationFrame(() =>
                    editor.select(
                      result.kind === 'output'
                        ? result.sourceConfigCardId
                        : result.id
                    )
                  );
                }
              },
              onCheckpoint: onHistoryCheckpoint,
              onLayout: (mode: 'tidy' | 'row' | 'column' | 'fit') => {
                onHistoryCheckpoint?.();
                applyOrganizationChange([
                  mode === 'fit'
                    ? { type: 'fit_group', groupId: node.id }
                    : { type: 'layout_group', groupId: node.id, mode },
                ]);
              },
              onToggle: () => {
                onHistoryCheckpoint?.();
                applyOrganizationChange([
                  {
                    type: 'set_group_collapsed',
                    groupId: node.id,
                    collapsed: !group.collapsed,
                  },
                ]);
              },
            },
          },
        };
      });
    const originalEdges = new Map(
      edges.map((edge) => [JSON.stringify([edge.source, edge.target]), edge])
    );
    const projectedEdges: BeatCanvasFlowEdge[] = projection.edges.map(
      (edge) => {
        const original = originalEdges.get(
          JSON.stringify([edge.source, edge.target])
        );
        const direct =
          edge.count === 1 &&
          edge.references[0].sourceCardId === edge.source &&
          edge.references[0].targetCardId === edge.target;
        return {
          ...(direct && original
            ? original
            : {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: 'beatdesign-reference' as const,
                selectable: true,
                deletable: false,
              }),
          label: edge.count > 1 ? String(edge.count) : undefined,
          data: {
            organizationReferences: edge.references,
            referenceCount: edge.count,
          },
        };
      }
    );
    return {
      nodes: [...groups, ...real],
      edges: projectedEdges,
      historyGroups: projection.historyGroups,
    };
  }, [
    applyOrganizationChange,
    canvasCards,
    edges,
    editor,
    nodes,
    onHistoryCheckpoint,
    organization,
    revision,
    timelineUsage,
  ]);

  const lineagePresentation = useMemo(() => {
    const nodes = displayGraph.nodes;
    const edges = displayGraph.edges;
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
              beatdesignLineageRole: role,
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
                beatdesignLineageRole: isUpstream
                  ? 'upstream'
                  : isDownstream
                    ? 'downstream'
                    : 'dimmed',
              },
            };
          })
        : [],
    };
  }, [displayGraph, edgesVisible]);

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
          onlyRenderVisibleElements
          edgesFocusable
          snapToGrid={isSnapToGridEnabled}
          snapGrid={[24, 24]}
          deleteKeyCode={['Backspace', 'Delete']}
          elevateNodesOnSelect
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
        >
          <Background
            id="beatdesign-minor-dots"
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.3}
            color="rgba(224, 226, 232, 0.24)"
          />
          <Background
            id="beatdesign-major-dots"
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
        {organization?.view.historyMode === 'all' ? (
          <section
            aria-label={organizationT('historyInspector')}
            className="absolute left-20 top-20 z-30 max-h-[min(55vh,520px)] w-[min(320px,calc(100vw-112px))] overflow-y-auto rounded-xl border border-white/15 bg-[var(--beat-surface)] p-3 text-[var(--beat-text-1)] shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">
                {organizationT('historyInspector')}
              </h2>
              <button
                type="button"
                className="min-h-11 px-2 text-xs underline"
                onClick={() =>
                  applyOrganizationChange([
                    { type: 'set_organization_view', historyMode: 'current' },
                  ])
                }
              >
                {organizationT('collapse')}
              </button>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-[var(--beat-text-2)]">
              {organizationT('historyReadOnly')}
            </p>
            {!displayGraph.historyGroups.length ? (
              <p className="text-sm text-[var(--beat-text-2)]">
                {organizationT('historyEmpty')}
              </p>
            ) : null}
            {displayGraph.historyGroups.map((history) => {
              const generation = canvasCards?.[history.generationCardId];
              const outputs = history.outputCardIds
                .map((id) => canvasCards?.[id])
                .filter(
                  (card): card is CanvasOutputCard => card?.kind === 'output'
                )
                .sort(
                  (a, b) =>
                    b.generationSnapshot.capturedAt.localeCompare(
                      a.generationSnapshot.capturedAt
                    ) || a.id.localeCompare(b.id)
                );
              const pinned = resolvePinnedGenerationOutputId({
                outputs,
                pinnedOutputId: generation?.pinnedOutputId,
              });
              const copy = getBeatCanvasNodeCopy();
              return (
                <details
                  key={history.generationCardId}
                  open
                  className="mb-2 rounded-lg border border-white/10 p-2"
                >
                  <summary className="min-h-11 cursor-pointer text-sm font-medium">
                    {generation?.name ?? history.generationCardId} ·{' '}
                    {outputs.length}
                  </summary>
                  <button
                    type="button"
                    className="mb-2 min-h-11 text-xs underline"
                    onClick={() => {
                      const group = Object.values(organization.groups).find(
                        (group) =>
                          group.memberCardIds.includes(history.generationCardId)
                      );
                      if (group?.collapsed)
                        applyOrganizationChange([
                          {
                            type: 'set_group_collapsed',
                            groupId: group.id,
                            collapsed: false,
                          },
                        ]);
                      requestAnimationFrame(() => {
                        editor.select(history.generationCardId);
                        const bounds = editor.getShapePageBounds(
                          history.generationCardId
                        );
                        if (bounds) editor.centerOnPoint(bounds.center);
                      });
                    }}
                  >
                    {organizationT('locate')}
                  </button>
                  {outputs.map((output) => (
                    <div
                      key={output.id}
                      className="mb-2 rounded-md border border-white/10 p-2 text-xs"
                    >
                      <p className="break-words font-medium">{output.name}</p>
                      <p
                        className={
                          output.status === 'failed'
                            ? 'mt-1 text-red-300'
                            : 'mt-1 text-[var(--beat-text-2)]'
                        }
                      >
                        {output.status === 'failed'
                          ? copy.generationFailed
                          : output.status === 'succeeded'
                            ? organizationT('ready')
                            : copy.processing}
                      </p>
                      {output.id === pinned ? (
                        <p className="mt-1 text-[var(--beat-graph)]">
                          {organizationT('displayedResult')}
                        </p>
                      ) : null}
                      {output.error ? (
                        <p className="mt-1 break-words text-red-300">
                          {output.error}
                        </p>
                      ) : null}
                      {output.resultText ? (
                        <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap">
                          {output.resultText}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={!output.url}
                        className="min-h-11 underline disabled:opacity-40"
                        onClick={() => {
                          if (output.url)
                            window.dispatchEvent(
                              new CustomEvent('beatcanvas:preview-media', {
                                detail: {
                                  type: output.type,
                                  url: output.url,
                                  title: output.name,
                                },
                              })
                            );
                        }}
                      >
                        {copy.viewResult}
                      </button>
                    </div>
                  ))}
                </details>
              );
            })}
          </section>
        ) : null}
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
