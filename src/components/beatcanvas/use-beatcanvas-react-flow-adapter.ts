'use client';

import type {
  WorkspaceAspectRatio,
  WorkspaceModelOption,
} from '@/core/effects/workspace-models';
import {
  buildProjectSnapshotDocument as buildProjectSnapshotDocumentFromCards,
  createProjectSnapshotRestorePlan,
  mergeCanvasRuntimeCardsIntoHistoryDocument,
} from '@/core/projects/project-canvas-document';
import type {
  ProjectSnapshotDocument,
  ProjectSnapshotShapeFrame,
} from '@/core/projects/project-snapshot';
import type {
  CanvasCard,
  CanvasCardMediaType,
  CanvasDraftCard,
  CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import { buildGenerationTakes } from '@/core/beatcanvas/generation-history';
import {
  isCanvasDraftCard,
  isCanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';
import { getDraftDefaultsFromModel } from '@/core/beatcanvas/draft-defaults';
import { buildDraftShapeText } from '@/core/beatcanvas/draft-shape';
import { getSelectableModel } from '@/core/beatcanvas/generation-controller';
import {
  resolveReferenceDrivenDraftAspectRatio,
  resolveWorkspaceAspectRatioFromDimensions,
} from '@/core/beatcanvas/composer';
import { resolveCanvasBatchOffset } from '@/core/beatcanvas/upload-layout';
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ASSET_CARD_NODE_TYPE,
  GENERATION_CARD_NODE_TYPE,
  type BeatCanvasEditor,
  type GenerationCardNodeProps,
} from './react-flow/beatcanvas-react-flow-types';
import type { StudioTranslateFn } from './beatcanvas-types';

type ShapePlacement = {
  x: number;
  y: number;
};

type ShapeSize = {
  w: number;
  h: number;
};

type PlacementSide = 'left' | 'right';
type CanvasFocusOptions = {
  zoom?: number;
};

const CARD_KIND_META_KEY = 'visugenCardKind';
const CARD_TYPE_META_KEY = 'visugenCardType';
const CARD_SOURCE_META_KEY = 'visugenCardSource';
const CARD_WORKFLOW_TEMPLATE_META_KEY = 'visugenWorkflowTemplateId';
const CARD_RESULT_SIZE = 360;
const VIDEO_FRAME_HEIGHT = 236;
const ANALYSIS_REPORT_FRAME_SIZE = { w: 480, h: 340 } as const;

const makeId = () => Math.random().toString(36).slice(2, 10);

const getAspectRatioValue = (
  taskType: CanvasCardMediaType,
  aspectRatio: WorkspaceAspectRatio
) => {
  const numericRatio = /^(\d+):(\d+)$/.exec(aspectRatio);
  if (numericRatio) {
    const width = Number(numericRatio[1]);
    const height = Number(numericRatio[2]);
    if (width > 0 && height > 0) {
      return width / height;
    }
  }

  switch (aspectRatio) {
    case 'landscape':
      return 16 / 9;
    case 'portrait':
      return 9 / 16;
    default:
      return taskType === 'video' ? 16 / 9 : 1;
  }
};

const roundToStep = (value: number, step = 8) =>
  Math.max(step, Math.round(value / step) * step);

const getDraftFrameSize = (
  taskType: CanvasCardMediaType,
  aspectRatio: WorkspaceAspectRatio
): ShapeSize => {
  const ratio = getAspectRatioValue(taskType, aspectRatio);
  const maxEdge = taskType === 'image' ? 380 : 420;

  if (ratio >= 1) {
    return {
      w: maxEdge,
      h: roundToStep(maxEdge / ratio, 1),
    };
  }

  return {
    w: roundToStep(maxEdge * ratio, 1),
    h: maxEdge,
  };
};

const getAssetFrameSize = (taskType: CanvasCardMediaType): ShapeSize =>
  taskType === 'video'
    ? { w: 420, h: VIDEO_FRAME_HEIGHT }
    : { w: CARD_RESULT_SIZE, h: CARD_RESULT_SIZE };

const getDraftShapeSignature = (
  card: CanvasDraftCard,
  outputs: CanvasOutputCard[]
) =>
  [
    card.name,
    card.type,
    card.generationMode ?? card.type,
    card.analysisDepth ?? '',
    card.resultText ?? '',
    card.aspectRatio,
    card.status,
    card.error ?? '',
    card.workflowTemplateId ?? '',
    card.pinnedOutputId ?? '',
    card.referenceCardIds.join('|'),
    outputs
      .map((output) =>
        [
          output.id,
          output.status,
          output.url ?? '',
          output.resultText ?? '',
          output.error ?? '',
          output.generationSnapshot.modelId,
          output.generationSnapshot.aspectRatio,
          output.generationSnapshot.capturedAt,
        ].join(':')
      )
      .join('|'),
  ].join('::');

const getAssetShapeSignature = (card: CanvasCard) =>
  [
    card.name,
    card.kind,
    card.type,
    card.url ?? '',
    card.sourceGenerationId ?? '',
  ].join('::');

export const buildGenerationCardPresentation = ({
  card,
  outputs,
}: {
  card: CanvasDraftCard;
  outputs: CanvasOutputCard[];
}) => {
  const orderedOutputs = [...outputs]
    .filter((output) => output.status !== 'failed')
    .sort(
      (left, right) =>
        left.generationSnapshot.capturedAt.localeCompare(
          right.generationSnapshot.capturedAt
        ) || left.id.localeCompare(right.id)
    );
  const latestOutput = orderedOutputs[orderedOutputs.length - 1] ?? null;
  const pinnedOutput = card.pinnedOutputId
    ? orderedOutputs.find(
        (output) =>
          output.id === card.pinnedOutputId &&
          output.status === 'succeeded' &&
          Boolean(output.url || output.resultText)
      ) ?? null
    : null;
  const latestSucceededOutput = [...orderedOutputs]
    .reverse()
    .find(
      (output) =>
        output.status === 'succeeded' &&
        Boolean(output.url || output.resultText)
    );
  const isAnalysis = card.generationMode === 'analysis';
  const analysisReportCount = isAnalysis
    ? orderedOutputs.filter(
        (output) => output.status === 'succeeded' && Boolean(output.resultText)
      ).length
    : 0;

  return {
    status: latestOutput?.status ?? card.status,
    isAnalysis,
    latestOutputUrl: isAnalysis
      ? null
      : pinnedOutput?.url ?? latestSucceededOutput?.url ?? card.url ?? null,
    latestOutputText:
      isAnalysis
        ? null
        : pinnedOutput?.resultText ??
          latestSucceededOutput?.resultText ??
          card.resultText ??
          null,
    analysisReportCount,
    takes: buildGenerationTakes({
      outputs: orderedOutputs,
      pinnedOutputId: card.pinnedOutputId,
    }),
  };
};

export const buildAnalysisReportNodeProps = (
  outputCard: CanvasOutputCard,
  label: string
): GenerationCardNodeProps | null => {
  if (
    outputCard.generationSnapshot.generationMode !== 'analysis' ||
    outputCard.status !== 'succeeded' ||
    !outputCard.resultText
  ) {
    return null;
  }

  return {
    w: ANALYSIS_REPORT_FRAME_SIZE.w,
    h: ANALYSIS_REPORT_FRAME_SIZE.h,
    cardMediaType: 'video',
    label,
    status: 'succeeded',
    isAnalysis: true,
    latestOutputUrl: null,
    latestOutputText: outputCard.resultText,
    analysisReportCount: 0,
    takes: [],
  };
};

type GroupableEditor = {
  setCurrentTool?: (tool: string) => void;
  groupShapes?: (
    shapeIds: string[],
    options?: {
      groupId?: string;
    }
  ) => void;
  getShape?: (shapeId: string) => { id: string; type: string } | null;
  getShapePageBounds?: (shapeId: string) => {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
};

type ConnectorBindableEditor = {
  getShape?: (shapeId: string) => { id: string; type: string } | null;
  getSortedChildIdsForParent?: (shapeId: string) => string[];
  getShapePageBounds?: (shapeId: string) => {
    x: number;
    y: number;
    w: number;
    h: number;
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
  } | null;
};

type DraftShapeSizeEditor = {
  getShape?: (shapeId: string) => {
    id: string;
    type: string;
    props?: {
      w?: number;
      h?: number;
    };
  } | null;
};

type FrameParentBoundsEditor = {
  getShape?: (shapeId: string) => {
    id: string;
    type?: string;
    parentId?: string;
  } | null;
  getShapePageBounds?: (shapeId: string) => {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
};

export const groupCanvasShapes = (
  editor: GroupableEditor | null | undefined,
  shapeIds: string[],
  explicitGroupId?: string
) => {
  const uniqueShapeIds = Array.from(
    new Set(shapeIds.filter((shapeId) => shapeId.length > 0))
  );

  if (!editor || uniqueShapeIds.length === 0) {
    return null;
  }

  const validShapeIds = uniqueShapeIds.filter((shapeId) => {
    const shape = editor.getShape?.(shapeId);

    if (shape === null) {
      return false;
    }

    const bounds = editor.getShapePageBounds?.(shapeId);

    if (!bounds) {
      return true;
    }

    return [bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite);
  });

  if (validShapeIds.length === 0) {
    return null;
  }

  if (validShapeIds.length === 1 || typeof editor.groupShapes !== 'function') {
    return validShapeIds[0] ?? null;
  }

  editor.setCurrentTool?.('select');
  try {
    editor.groupShapes(
      validShapeIds,
      explicitGroupId ? { groupId: explicitGroupId } : undefined
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('group bounds are invalid')
    ) {
      return validShapeIds[0] ?? null;
    }

    throw error;
  }

  if (explicitGroupId) {
    return editor.getShape?.(explicitGroupId)?.id ?? null;
  }

  return validShapeIds[0] ?? null;
};

export const resolveConnectorBindableShapeId = (
  editor: ConnectorBindableEditor | null | undefined,
  shapeId: string,
  options?: {
    preserveGroup?: boolean;
  }
) => {
  if (!editor || shapeId.length === 0) {
    return null;
  }

  const shape = editor.getShape?.(shapeId);
  if (!shape || shape.type !== 'group') {
    return shapeId;
  }

  if (options?.preserveGroup) {
    return shapeId;
  }

  const childIds = editor.getSortedChildIdsForParent?.(shapeId) ?? [];
  if (childIds.length === 0) {
    return shapeId;
  }

  const rankedChildren = childIds
    .map((childId) => ({
      childId,
      bounds: editor.getShapePageBounds?.(childId) ?? null,
    }))
    .filter(
      (
        entry
      ): entry is {
        childId: string;
        bounds: { x: number; y: number; w: number; h: number };
      } => Boolean(entry.bounds)
    )
    .sort((left, right) => {
      const areaDelta =
        right.bounds.w * right.bounds.h - left.bounds.w * left.bounds.h;
      if (areaDelta !== 0) {
        return areaDelta;
      }

      if (left.bounds.x !== right.bounds.x) {
        return left.bounds.x - right.bounds.x;
      }

      return left.bounds.y - right.bounds.y;
    });

  return rankedChildren[0]?.childId ?? childIds[0] ?? shapeId;
};

export const resolveFrameParentBounds = (
  editor: FrameParentBoundsEditor | null | undefined,
  shapeId: string
) => {
  if (!editor || shapeId.length === 0) {
    return null;
  }

  const shape = editor.getShape?.(shapeId);
  const parentId = shape?.parentId;

  if (!parentId || !editor.getShape?.(parentId)) {
    return null;
  }

  try {
    return editor.getShapePageBounds?.(parentId as any) ?? null;
  } catch {
    return null;
  }
};

export const resolveDraftShapeSize = (
  editor: DraftShapeSizeEditor | null | undefined,
  card: CanvasDraftCard
) => {
  if (!card.workflowTemplateId) {
    return getDraftFrameSize(card.type, card.aspectRatio);
  }

  const existingShape = editor?.getShape?.(card.id);
  const existingWidth = existingShape?.props?.w;
  const existingHeight = existingShape?.props?.h;

  if (
    typeof existingWidth === 'number' &&
    existingWidth > 0 &&
    typeof existingHeight === 'number' &&
    existingHeight > 0
  ) {
    return {
      w: existingWidth,
      h: existingHeight,
    };
  }

  return getDraftFrameSize(card.type, card.aspectRatio);
};

export function useBeatCanvasReactFlowAdapter({
  studioT,
  imageModels,
  videoModels,
  initialImageModelId,
  initialVideoModelId,
  canvasCards,
  canvasCardsRef,
  removeCanvasCard,
  replaceCanvasCards,
  setCanvasCard,
  setActiveComposerCardId,
}: {
  studioT: StudioTranslateFn;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  initialImageModelId: string | null;
  initialVideoModelId: string | null;
  canvasCards: Record<string, CanvasCard>;
  canvasCardsRef: MutableRefObject<Record<string, CanvasCard>>;
  removeCanvasCard: (cardId: string) => void;
  replaceCanvasCards: (cards: Record<string, CanvasCard>) => void;
  setCanvasCard: (card: CanvasCard) => void;
  setActiveComposerCardId: (cardId: string | null) => void;
}) {
  const editorRef = useRef<BeatCanvasEditor | null>(null);
  const syncedDraftShapeSignaturesRef = useRef<Record<string, string>>({});
  const syncedAssetShapeSignaturesRef = useRef<Record<string, string>>({});
  const undoStackRef = useRef<ProjectSnapshotDocument[]>([]);
  const redoStackRef = useRef<ProjectSnapshotDocument[]>([]);
  const isRestoringHistoryRef = useRef(false);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, []);

  const captureCanvasDocument = useCallback((): ProjectSnapshotDocument => {
    const editor = editorRef.current;
    const frames = Object.values(canvasCardsRef.current).reduce<
      Record<string, ProjectSnapshotShapeFrame>
    >((accumulator, card) => {
      const bounds = editor?.getShapePageBounds(card.id);
      if (bounds) {
        accumulator[card.id] = {
          x: bounds.x,
          y: bounds.y,
          w: bounds.w,
          h: bounds.h,
        };
      }
      return accumulator;
    }, {});

    return buildProjectSnapshotDocumentFromCards({
      cardsById: canvasCardsRef.current,
      framesById: frames,
      camera: editor?.getCamera(),
    });
  }, [canvasCardsRef]);

  const recordCanvasHistory = useCallback(() => {
    if (isRestoringHistoryRef.current) return;
    undoStackRef.current = [
      ...undoStackRef.current.slice(-49),
      captureCanvasDocument(),
    ];
    redoStackRef.current = [];
    syncHistoryState();
  }, [captureCanvasDocument, syncHistoryState]);

  const handleSelectShape = useCallback((shapeId: string | null) => {
    const editor = editorRef.current;
    if (!editor || !shapeId) return;

    if (typeof editor.setCurrentTool === 'function') {
      editor.setCurrentTool('select');
    }

    if (typeof editor.select === 'function') {
      editor.select(shapeId);
      return;
    }

    if (typeof editor.setSelectedShapes === 'function') {
      editor.setSelectedShapes([shapeId]);
    }
  }, []);

  const centerViewportOnPagePoint = useCallback(
    (point: { x: number; y: number }, options: CanvasFocusOptions = {}) => {
      const editor = editorRef.current;

      if (!editor) return;

      editor.centerOnPoint(point, {
        zoom: options.zoom,
        animation: {
          duration: 220,
        },
      });
    },
    []
  );

  const focusShape = useCallback(
    (shapeId: string, options: CanvasFocusOptions = {}) => {
      const editor = editorRef.current;
      if (!editor) return;

      const bounds = editor.getShapePageBounds(shapeId as any);
      if (!bounds) return;

      centerViewportOnPagePoint(
        {
          x: bounds.x + bounds.w / 2,
          y: bounds.y + bounds.h / 2,
        },
        options
      );
    },
    [centerViewportOnPagePoint]
  );

  const focusShapes = useCallback(
    (shapeIds: string[], options: CanvasFocusOptions = {}) => {
      const editor = editorRef.current;
      if (!editor) return;

      const bounds = shapeIds
        .map((shapeId) => editor.getShapePageBounds(shapeId as any))
        .filter(Boolean);
      if (bounds.length === 0) return;

      const union = bounds.reduce((accumulator: any, current: any) => {
        if (!accumulator) {
          return {
            x: current.x,
            y: current.y,
            w: current.w,
            h: current.h,
            minX: current.minX,
            minY: current.minY,
            maxX: current.maxX,
            maxY: current.maxY,
          };
        }

        const minX = Math.min(accumulator.minX, current.minX);
        const minY = Math.min(accumulator.minY, current.minY);
        const maxX = Math.max(accumulator.maxX, current.maxX);
        const maxY = Math.max(accumulator.maxY, current.maxY);

        return {
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
          minX,
          minY,
          maxX,
          maxY,
        };
      }, null);

      if (!union) return;

      centerViewportOnPagePoint(
        {
          x: union.x + union.w / 2,
          y: union.y + union.h / 2,
        },
        options
      );
    },
    [centerViewportOnPagePoint]
  );

  const groupShapes = useCallback(
    (shapeIds: string[], explicitGroupId?: string) => {
      const editor = editorRef.current;
      const groupId = explicitGroupId ?? `shape:${makeId()}`;
      return groupCanvasShapes(editor, shapeIds, groupId);
    },
    []
  );

  const getViewportCenter = useCallback(() => {
    const editor = editorRef.current;
    const bounds = editor?.getViewportPageBounds?.();
    return bounds?.center
      ? {
          x: bounds.center.x,
          y: bounds.center.y,
        }
      : null;
  }, []);

  const getCanvasPlacement = useCallback(
    (
      sourceIds: string[] = [],
      offsetIndex = 0,
      size?: ShapeSize,
      side: PlacementSide = 'right'
    ): ShapePlacement => {
      const offset = resolveCanvasBatchOffset(offsetIndex, size);
      const editor = editorRef.current;
      if (!editor) {
        return {
          x: 200 + offset.x,
          y: 180 + offset.y,
        };
      }

      const existingBounds = sourceIds
        .map((id) => editor.getShapePageBounds(id as any))
        .filter(Boolean);

      if (existingBounds.length > 0) {
        const right = Math.max(
          ...existingBounds.map((bounds: any) => bounds.maxX)
        );
        const left = Math.min(
          ...existingBounds.map((bounds: any) => bounds.minX)
        );
        const top = Math.min(
          ...existingBounds.map((bounds: any) => bounds.minY)
        );
        const bottom = Math.max(
          ...existingBounds.map((bounds: any) => bounds.maxY)
        );
        const width = size?.w ?? 360;
        const height = size?.h ?? 260;

        return {
          x:
            side === 'left'
              ? left - width - 96 - offset.x
              : right + 96 + offset.x,
          y: top + Math.max(0, (bottom - top - height) / 2) + offset.y,
        };
      }

      if (size && typeof editor.getViewportPageBounds === 'function') {
        const viewportCenter = editor.getViewportPageBounds().center;
        return {
          x: viewportCenter.x - size.w / 2 + offset.x,
          y: viewportCenter.y - size.h / 2 + offset.y,
        };
      }

      return {
        x: 200 + offset.x,
        y: 160 + offset.y,
      };
    },
    []
  );

  const createConnectorBetweenCards = useCallback(
    (
      sourceCardId: string,
      targetCardId: string,
      options?: { recordHistory?: boolean }
    ) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (options?.recordHistory) {
        recordCanvasHistory();
      }

      const sourceShapeId = resolveConnectorBindableShapeId(
        editor,
        sourceCardId
      );
      const targetShapeId = resolveConnectorBindableShapeId(
        editor,
        targetCardId,
        { preserveGroup: true }
      );
      if (!sourceShapeId || !targetShapeId) return;
      editor.createConnection(sourceShapeId, targetShapeId);
    },
    [recordCanvasHistory]
  );

  const removeConnectorBetweenCards = useCallback(
    (
      sourceCardId: string,
      targetCardId: string,
      options?: { recordHistory?: boolean }
    ) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (options?.recordHistory) {
        recordCanvasHistory();
      }

      const sourceShapeId = resolveConnectorBindableShapeId(
        editor,
        sourceCardId
      );
      const targetShapeId = resolveConnectorBindableShapeId(
        editor,
        targetCardId,
        { preserveGroup: true }
      );
      if (!sourceShapeId || !targetShapeId) return;
      editor.deleteConnection(sourceShapeId, targetShapeId);
    },
    [recordCanvasHistory]
  );

  const syncDraftShape = useCallback(
    (card: CanvasDraftCard, outputs: CanvasOutputCard[]) => {
      const editor = editorRef.current;
      if (!editor) return;

      const presentation = buildGenerationCardPresentation({
        card,
        outputs,
      });
      const size = resolveDraftShapeSize(editor, card);

      editor.updateShape({
        id: card.id,
        type: GENERATION_CARD_NODE_TYPE,
        meta: {
          [CARD_KIND_META_KEY]: 'generation',
          [CARD_TYPE_META_KEY]: card.type,
          ...(card.workflowTemplateId
            ? {
                [CARD_WORKFLOW_TEMPLATE_META_KEY]: card.workflowTemplateId,
              }
            : {}),
        },
        props: {
          w: size.w,
          h: size.h,
          cardMediaType: card.type,
          label: buildDraftShapeText(card),
          ...presentation,
        },
      });
    },
    []
  );

  const syncAssetShape = useCallback((card: CanvasCard) => {
    const editor = editorRef.current;
    if (!editor || !card.url) return;

    editor.updateShape({
      id: card.id,
      type: ASSET_CARD_NODE_TYPE,
      meta: {
        [CARD_KIND_META_KEY]: card.kind,
        [CARD_TYPE_META_KEY]: card.type,
        ...(card.sourceGenerationId
          ? {
              [CARD_SOURCE_META_KEY]: card.sourceGenerationId,
            }
          : {}),
        ...(card.workflowTemplateId
          ? {
              [CARD_WORKFLOW_TEMPLATE_META_KEY]: card.workflowTemplateId,
            }
          : {}),
      },
      props: {
        title: card.name,
        thumbnailUrl: card.url,
      },
    });
  }, []);

  const insertAssetCard = useCallback(
    ({
      type,
      url,
      name,
      kind,
      assetId,
      sourceGenerationId,
      sourceCardIds = [],
      anchorCardIds,
      placementSide = 'right',
      placementOffsetIndex = 0,
      activateOnInsert = true,
      size,
      shapeId,
      frame,
      existingCard,
      fitMode = 'cover',
      chromeMode = 'default',
      workflowTemplateId = null,
      recordHistory = true,
    }: {
      type: CanvasCardMediaType;
      url: string;
      name: string;
      kind: CanvasCard['kind'];
      assetId?: string | null;
      sourceGenerationId?: string | null;
      sourceCardIds?: string[];
      anchorCardIds?: string[];
      placementSide?: PlacementSide;
      placementOffsetIndex?: number;
      activateOnInsert?: boolean;
      size?: ShapeSize;
      shapeId?: string;
      frame?: ProjectSnapshotShapeFrame;
      existingCard?: CanvasCard;
      fitMode?: 'cover' | 'contain';
      chromeMode?: 'default' | 'frameless';
      workflowTemplateId?: string | null;
      recordHistory?: boolean;
    }) => {
      const editor = editorRef.current;
      if (!editor) return null;

      if (recordHistory) {
        recordCanvasHistory();
      }

      const nextSize = frame
        ? { w: frame.w, h: frame.h }
        : (size ?? getAssetFrameSize(type));
      const inferredAspectRatio = resolveWorkspaceAspectRatioFromDimensions({
        width: nextSize.w,
        height: nextSize.h,
        fallback:
          existingCard?.aspectRatio ?? (type === 'image' ? '1:1' : '16:9'),
      });
      const fallbackPlacement = getCanvasPlacement(
        anchorCardIds ?? sourceCardIds,
        placementOffsetIndex,
        nextSize,
        placementSide
      );
      const { x, y } = frame ?? fallbackPlacement;
      const nextShapeId = shapeId ?? `shape:${makeId()}`;

      editor.createShape({
        id: nextShapeId,
        type: ASSET_CARD_NODE_TYPE,
        x,
        y,
        meta: {
          [CARD_KIND_META_KEY]: kind,
          [CARD_TYPE_META_KEY]: type,
          ...(sourceGenerationId
            ? {
                [CARD_SOURCE_META_KEY]: sourceGenerationId,
              }
            : {}),
          ...(workflowTemplateId
            ? {
                [CARD_WORKFLOW_TEMPLATE_META_KEY]: workflowTemplateId,
              }
            : {}),
        },
        props: {
          w: nextSize.w,
          h: nextSize.h,
          cardMediaType: type,
          title: name,
          thumbnailUrl: url,
          fitMode,
          chromeMode,
        },
      });

      for (const sourceCardId of sourceCardIds) {
        createConnectorBetweenCards(sourceCardId, nextShapeId);
      }

      setCanvasCard(
        existingCard
          ? { ...existingCard, aspectRatio: inferredAspectRatio }
          : {
              id: nextShapeId,
              assetId: assetId ?? null,
              kind,
              type,
              name,
              url,
              prompt: '',
              referenceCardIds: sourceCardIds,
              workflowTemplateId,
              status: 'succeeded',
              error: null,
              modelId: '',
              aspectRatio: inferredAspectRatio,
              outputQuality: type === 'image' ? '1k' : '1080p',
              duration: '5s',
              mode: 'quality',
              variant: 'standard',
              quality: 'standard',
              sourceGenerationId: sourceGenerationId ?? null,
            }
      );

      if (activateOnInsert) {
        handleSelectShape(nextShapeId);
        focusShape(nextShapeId);
      }
      return nextShapeId;
    },
    [
      createConnectorBetweenCards,
      focusShape,
      getCanvasPlacement,
      handleSelectShape,
      setCanvasCard,
      recordCanvasHistory,
    ]
  );

  const materializeAnalysisReport = useCallback(
    ({
      outputCard,
      draftCard,
      frame,
      connectSource = true,
    }: {
      outputCard: CanvasOutputCard;
      draftCard: CanvasDraftCard;
      frame?: ProjectSnapshotShapeFrame;
      connectSource?: boolean;
    }) => {
      const editor = editorRef.current;
      const reportProps = buildAnalysisReportNodeProps(
        outputCard,
        studioT('canvas.shapes.analysisReport')
      );
      if (!editor || !reportProps) return false;

      const reportIndex = Object.values(canvasCardsRef.current).filter(
        (candidate) =>
          isCanvasOutputCard(candidate) &&
          candidate.id !== outputCard.id &&
          candidate.sourceConfigCardId === draftCard.id &&
          candidate.generationSnapshot.generationMode === 'analysis' &&
          candidate.status === 'succeeded' &&
          Boolean(candidate.resultText)
      ).length;
      const reportSize = frame
        ? { w: frame.w, h: frame.h }
        : ANALYSIS_REPORT_FRAME_SIZE;
      const placement =
        frame ??
        getCanvasPlacement(
          [draftCard.id],
          reportIndex,
          reportSize,
          'right'
        );

      editor.createShape({
        id: outputCard.id,
        type: GENERATION_CARD_NODE_TYPE,
        x: placement.x,
        y: placement.y,
        meta: {
          [CARD_KIND_META_KEY]: 'output',
          [CARD_TYPE_META_KEY]: 'video',
          ...(outputCard.sourceGenerationId
            ? { [CARD_SOURCE_META_KEY]: outputCard.sourceGenerationId }
            : {}),
        },
        props: {
          ...reportProps,
          w: reportSize.w,
          h: reportSize.h,
        },
      });
      if (connectSource) {
        createConnectorBetweenCards(draftCard.id, outputCard.id);
      }
      return true;
    },
    [canvasCardsRef, createConnectorBetweenCards, getCanvasPlacement, studioT]
  );

  const createGenerationOutput = useCallback(
    ({
      draftCard,
      name,
      suppressFocus = false,
      shapeId,
      frame,
      existingCard,
      connectSource = true,
    }: {
      draftCard: CanvasDraftCard;
      name: string;
      suppressFocus?: boolean;
      shapeId?: string;
      frame?: ProjectSnapshotShapeFrame;
      existingCard?: CanvasOutputCard;
      connectSource?: boolean;
    }) => {
      if (!editorRef.current) return null;

      const outputCardId = shapeId ?? `output:${makeId()}`;
      const models = draftCard.type === 'image' ? imageModels : videoModels;
      const model = getSelectableModel(models, draftCard.modelId);
      const resolvedAspectRatio = resolveReferenceDrivenDraftAspectRatio({
        draftCard,
        cards: canvasCardsRef.current,
        model,
      });
      const nextCard: CanvasOutputCard = existingCard ?? {
        ...draftCard,
        aspectRatio: resolvedAspectRatio,
        id: outputCardId,
        kind: 'output',
        name,
        url: null,
        referenceCardIds: [draftCard.id],
        status: 'pending',
        error: null,
        sourceGenerationId: null,
        sourceConfigCardId: draftCard.id,
        generationRunId: `run:${makeId()}`,
        generationSnapshot: {
          type: draftCard.type,
          generationMode: draftCard.generationMode,
          analysisDepth: draftCard.analysisDepth,
          prompt: draftCard.prompt,
          referenceCardIds: [...draftCard.referenceCardIds],
          workflowTemplateId: draftCard.workflowTemplateId,
          modelId: draftCard.modelId,
          aspectRatio: resolvedAspectRatio,
          outputQuality: draftCard.outputQuality,
          duration: draftCard.duration,
          language: draftCard.language,
          mode: draftCard.mode,
          variant: draftCard.variant,
          quality: draftCard.quality,
          ...(draftCard.characterOrientation
            ? { characterOrientation: draftCard.characterOrientation }
            : {}),
          ...(draftCard.backgroundSource
            ? { backgroundSource: draftCard.backgroundSource }
            : {}),
          resultText: draftCard.resultText ?? null,
          capturedAt: new Date().toISOString(),
        },
      };
      setCanvasCard(nextCard);

      const createdReportShape = materializeAnalysisReport({
        outputCard: nextCard,
        draftCard,
        frame,
        connectSource,
      });

      if (!suppressFocus && createdReportShape) {
        focusShape(nextCard.id);
      } else if (!suppressFocus) {
        focusShape(draftCard.id);
      }
      return outputCardId;
    },
    [
      canvasCardsRef,
      focusShape,
      imageModels,
      materializeAnalysisReport,
      setCanvasCard,
      videoModels,
    ]
  );

  const updateGenerationOutput = useCallback(
    (outputCardId: string, patch: Partial<CanvasOutputCard>) => {
      const current = canvasCardsRef.current[outputCardId];
      if (!isCanvasOutputCard(current)) return;
      setCanvasCard({
        ...current,
        ...patch,
      });
    },
    [canvasCardsRef, setCanvasCard]
  );

  const completeGenerationOutput = useCallback(
    ({
      outputCardId,
      draftCard,
      url,
      resultText = null,
      name,
      sourceGenerationId = null,
      suppressFocus = false,
    }: {
      outputCardId: string;
      draftCard: CanvasDraftCard;
      url?: string | null;
      resultText?: string | null;
      name: string;
      sourceGenerationId?: string | null;
      suppressFocus?: boolean;
    }) => {
      const current = canvasCardsRef.current[outputCardId];
      if (!editorRef.current || !isCanvasOutputCard(current)) return null;

      const completedOutputCard: CanvasOutputCard = {
        ...current,
        name,
        url: url ?? null,
        resultText,
        status: 'succeeded',
        error: null,
        sourceGenerationId,
      };
      const isAnalysisOutput =
        completedOutputCard.generationSnapshot.generationMode === 'analysis';
      setCanvasCard(completedOutputCard);
      setCanvasCard({
        ...draftCard,
        url: isAnalysisOutput ? null : (url ?? null),
        resultText: isAnalysisOutput ? null : resultText,
      });

      const createdReportShape = materializeAnalysisReport({
        outputCard: completedOutputCard,
        draftCard,
      });

      if (!suppressFocus && createdReportShape) {
        focusShape(completedOutputCard.id);
      } else if (!suppressFocus) {
        focusShape(draftCard.id);
      }
      return outputCardId;
    },
    [
      canvasCardsRef,
      focusShape,
      materializeAnalysisReport,
      setCanvasCard,
    ]
  );

  const createDraftCard = useCallback(
    ({
      taskType,
      prompt,
      referenceCardIds,
      workflowTemplateId = null,
      presetName,
      aspectRatio,
      language,
      placementSide = 'right',
      anchorCardIds,
      placementOffsetIndex = 0,
      placementPoint,
      connectReferences = true,
      shapeId,
      frame,
      existingCard,
      activateOnInsert = true,
      recordHistory = true,
    }: {
      taskType: CanvasCardMediaType;
      prompt: string;
      referenceCardIds: string[];
      workflowTemplateId?: string | null;
      presetName?: string;
      aspectRatio?: WorkspaceAspectRatio;
      language?: CanvasDraftCard['language'];
      placementSide?: PlacementSide;
      anchorCardIds?: string[];
      placementOffsetIndex?: number;
      placementPoint?: ShapePlacement;
      connectReferences?: boolean;
      shapeId?: string;
      frame?: ProjectSnapshotShapeFrame;
      existingCard?: CanvasDraftCard;
      activateOnInsert?: boolean;
      recordHistory?: boolean;
    }) => {
      const editor = editorRef.current;
      const model =
        taskType === 'image'
          ? getSelectableModel(imageModels, initialImageModelId)
          : getSelectableModel(videoModels, initialVideoModelId);

      if (!editor || !model) return null;

      if (recordHistory) {
        recordCanvasHistory();
      }

      const defaults = getDraftDefaultsFromModel(taskType, model);
      const cardId = shapeId ?? `shape:${makeId()}`;
      const baseNextCard: CanvasDraftCard = existingCard ?? {
        id: cardId,
        kind: 'generation',
        type: defaults.type,
        generationMode: defaults.type,
        name:
          presetName ??
          (defaults.type === 'image'
            ? studioT('canvas.frame.imageTitle')
            : studioT('canvas.frame.videoTitle')),
        url: null,
        prompt,
        referenceCardIds,
        workflowTemplateId,
        status: 'idle',
        error: null,
        modelId: defaults.modelId,
        aspectRatio: aspectRatio ?? defaults.aspectRatio,
        outputQuality: defaults.outputQuality,
        duration: defaults.duration,
        language: language ?? defaults.language,
        mode: defaults.mode,
        variant: defaults.variant,
        quality: defaults.quality,
        ...(defaults.characterOrientation
          ? { characterOrientation: defaults.characterOrientation }
          : {}),
        ...(defaults.backgroundSource
          ? { backgroundSource: defaults.backgroundSource }
          : {}),
        sourceGenerationId: null,
      };
      const selectedCardModel = getSelectableModel(
        taskType === 'image' ? imageModels : videoModels,
        baseNextCard.modelId
      );
      const nextCard: CanvasDraftCard = {
        ...baseNextCard,
        aspectRatio: resolveReferenceDrivenDraftAspectRatio({
          draftCard: baseNextCard,
          cards: canvasCardsRef.current,
          model: selectedCardModel,
        }),
      };
      const size = frame
        ? { w: frame.w, h: frame.h }
        : getDraftFrameSize(nextCard.type, nextCard.aspectRatio);
      const fallbackPlacement = placementPoint
        ? {
            x: placementPoint.x,
            y: placementPoint.y,
          }
        : getCanvasPlacement(
            anchorCardIds ?? referenceCardIds,
            placementOffsetIndex,
            size,
            placementSide
          );
      const { x, y } = frame ?? fallbackPlacement;

      editor.createShape({
        id: cardId,
        type: GENERATION_CARD_NODE_TYPE,
        x,
        y,
        meta: {
          [CARD_KIND_META_KEY]: 'generation',
          [CARD_TYPE_META_KEY]: defaults.type,
          ...(workflowTemplateId
            ? {
                [CARD_WORKFLOW_TEMPLATE_META_KEY]: workflowTemplateId,
              }
            : {}),
        },
        props: {
          w: size.w,
          h: size.h,
          cardMediaType: defaults.type,
          label: buildDraftShapeText(nextCard),
          status: 'idle',
          takes: [],
        },
      });

      if (connectReferences) {
        for (const referenceCardId of referenceCardIds) {
          createConnectorBetweenCards(referenceCardId, cardId);
        }
      }

      setCanvasCard(nextCard);
      if (activateOnInsert) {
        setActiveComposerCardId(cardId);
        handleSelectShape(cardId);
        focusShape(cardId);
      }
      return cardId;
    },
    [
      createConnectorBetweenCards,
      focusShape,
      getCanvasPlacement,
      handleSelectShape,
      imageModels,
      initialImageModelId,
      initialVideoModelId,
      setActiveComposerCardId,
      setCanvasCard,
      recordCanvasHistory,
      canvasCardsRef,
      studioT,
      videoModels,
    ]
  );

  const buildProjectSnapshotDocument = captureCanvasDocument;

  const restoreProjectSnapshot = useCallback(
    (document: ProjectSnapshotDocument) => {
      const restorePlan = createProjectSnapshotRestorePlan(document);
      const restoredCardIds: string[] = [];
      const restoredDraftIds: string[] = [];

      for (const item of restorePlan.assetCards) {
        const insertedAssetCardId = insertAssetCard({
          type: item.card.type,
          url: item.card.url ?? '',
          name: item.card.name,
          kind: item.card.kind,
          sourceGenerationId: item.card.sourceGenerationId,
          sourceCardIds: [],
          activateOnInsert: false,
          shapeId: item.card.id,
          frame: item.frame,
          existingCard: item.card,
          recordHistory: false,
        });
        if (insertedAssetCardId) {
          restoredCardIds.push(insertedAssetCardId);
        }
      }

      for (const item of restorePlan.draftCards) {
        const insertedDraftCardId = createDraftCard({
          taskType: item.card.type,
          prompt: item.card.prompt,
          referenceCardIds: item.card.referenceCardIds,
          workflowTemplateId: item.card.workflowTemplateId,
          presetName: item.card.name,
          connectReferences: false,
          shapeId: item.card.id,
          frame: item.frame,
          existingCard: item.card,
          activateOnInsert: false,
          recordHistory: false,
        });
        if (insertedDraftCardId) {
          restoredCardIds.push(insertedDraftCardId);
          restoredDraftIds.push(insertedDraftCardId);
        }
      }

      for (const item of restorePlan.outputCards) {
        const sourceConfigCard = canvasCardsRef.current[
          item.card.sourceConfigCardId
        ];
        if (!isCanvasDraftCard(sourceConfigCard)) {
          continue;
        }

        const insertedOutputCardId = createGenerationOutput({
          draftCard: sourceConfigCard,
          name: item.card.name,
          suppressFocus: true,
          shapeId: item.card.id,
          frame: item.frame,
          existingCard: item.card,
          connectSource: true,
        });
        if (insertedOutputCardId) {
          restoredCardIds.push(insertedOutputCardId);
        }
      }

      for (const connector of restorePlan.connectors) {
        createConnectorBetweenCards(
          connector.sourceCardId,
          connector.targetCardId
        );
      }

      if (restoredDraftIds.length > 0) {
        setActiveComposerCardId(restoredDraftIds[0]);
      }

      const restoreCameraOrFocusCards = () => {
        if (document.camera) {
          editorRef.current?.setCamera(document.camera, {
            animation: { duration: 0 },
          });
          return;
        }

        if (restoredCardIds.length > 0) {
          focusShapes(restoredCardIds);
        }
      };

      if (
        typeof window !== 'undefined' &&
        typeof window.requestAnimationFrame === 'function'
      ) {
        window.requestAnimationFrame(restoreCameraOrFocusCards);
      } else {
        restoreCameraOrFocusCards();
      }
    },
    [
      createConnectorBetweenCards,
      createDraftCard,
      createGenerationOutput,
      canvasCardsRef,
      editorRef,
      focusShapes,
      insertAssetCard,
      setActiveComposerCardId,
    ]
  );

  const applyHistoryDocument = useCallback(
    (document: ProjectSnapshotDocument) => {
      const editor = editorRef.current;
      if (!editor) return;

      isRestoringHistoryRef.current = true;
      const historyDocument = mergeCanvasRuntimeCardsIntoHistoryDocument({
        target: document,
        current: captureCanvasDocument(),
      });
      const currentShapeIds = editor.getCurrentPageShapes().map((shape) => shape.id);
      if (currentShapeIds.length > 0) {
        editor.deleteShapes(currentShapeIds);
      }
      replaceCanvasCards({});
      syncedDraftShapeSignaturesRef.current = {};
      syncedAssetShapeSignaturesRef.current = {};
      restoreProjectSnapshot(historyDocument);

      const finishRestore = () => {
        isRestoringHistoryRef.current = false;
      };
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(finishRestore);
      } else {
        finishRestore();
      }
    },
    [captureCanvasDocument, replaceCanvasCards, restoreProjectSnapshot]
  );

  const undoCanvas = useCallback(() => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [
      ...redoStackRef.current.slice(-49),
      captureCanvasDocument(),
    ];
    applyHistoryDocument(previous);
    syncHistoryState();
  }, [applyHistoryDocument, captureCanvasDocument, syncHistoryState]);

  const redoCanvas = useCallback(() => {
    const next = redoStackRef.current.at(-1);
    if (!next) return;

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [
      ...undoStackRef.current.slice(-49),
      captureCanvasDocument(),
    ];
    applyHistoryDocument(next);
    syncHistoryState();
  }, [applyHistoryDocument, captureCanvasDocument, syncHistoryState]);

  useEffect(() => {
    const nextSignatures: Record<string, string> = {};

    for (const card of Object.values(canvasCards)) {
      if (!isCanvasDraftCard(card)) continue;

      const outputs = Object.values(canvasCards).filter(
        (candidate): candidate is CanvasOutputCard =>
          isCanvasOutputCard(candidate) &&
          candidate.sourceConfigCardId === card.id
      );
      const signature = getDraftShapeSignature(card, outputs);
      nextSignatures[card.id] = signature;

      if (syncedDraftShapeSignaturesRef.current[card.id] === signature) {
        continue;
      }

      syncDraftShape(card, outputs);
    }

    syncedDraftShapeSignaturesRef.current = nextSignatures;
  }, [canvasCards, syncDraftShape]);

  useEffect(() => {
    const nextSignatures: Record<string, string> = {};

    for (const card of Object.values(canvasCards)) {
      if (isCanvasDraftCard(card) || isCanvasOutputCard(card) || !card.url) {
        continue;
      }

      const signature = getAssetShapeSignature(card);
      nextSignatures[card.id] = signature;

      if (syncedAssetShapeSignaturesRef.current[card.id] === signature) {
        continue;
      }

      syncAssetShape(card);
    }

    syncedAssetShapeSignaturesRef.current = nextSignatures;
  }, [canvasCards, syncAssetShape]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const visibleReportIds = new Set(
      Object.values(canvasCards)
        .filter(
          (card): card is CanvasOutputCard =>
            isCanvasOutputCard(card) &&
            card.generationSnapshot.generationMode === 'analysis' &&
            card.status === 'succeeded' &&
            Boolean(card.resultText)
        )
        .map((card) => card.id)
    );
    const orphanedReportShapeIds = editor
      .getCurrentPageShapes()
      .filter(
        (shape) =>
          shape.meta[CARD_KIND_META_KEY] === 'output' &&
          !visibleReportIds.has(shape.id)
      )
      .map((shape) => shape.id);

    if (orphanedReportShapeIds.length > 0) {
      editor.deleteShapes(orphanedReportShapeIds);
    }
  }, [canvasCards]);

  const deleteCanvasCard = useCallback(
    (cardId: string) => {
      const editor = editorRef.current;
      if (!editor || typeof editor.deleteShape !== 'function') {
        return;
      }

      recordCanvasHistory();
      editor.deleteShape(cardId as any);
      removeCanvasCard(cardId);
    },
    [recordCanvasHistory, removeCanvasCard]
  );

  const updateCanvasCardFrame = useCallback(
    (cardId: string, frame: ProjectSnapshotShapeFrame) => {
      const editor = editorRef.current;
      if (!editor || typeof editor.updateShape !== 'function') {
        return;
      }

      const existingShape = editor.getShape?.(cardId as any) as
        | {
            type?: string;
            parentId?: string;
            props?: {
              w?: number;
              h?: number;
            };
          }
        | undefined;

      const parentBounds = resolveFrameParentBounds(editor, cardId);

      editor.updateShape({
        id: cardId,
        type: existingShape?.type ?? ASSET_CARD_NODE_TYPE,
        x: parentBounds ? frame.x - parentBounds.x : frame.x,
        y: parentBounds ? frame.y - parentBounds.y : frame.y,
        props: {
          ...(existingShape?.props ?? {}),
          w: frame.w,
          h: frame.h,
        },
      });
    },
    []
  );

  const bringCanvasCardsToFront = useCallback((cardIds: string[]) => {
    const editor = editorRef.current as
      | {
          bringToFront?: (shapeIds: string[]) => void;
        }
      | null
      | undefined;

    if (!editor?.bringToFront || cardIds.length === 0) {
      return;
    }

    editor.bringToFront(Array.from(new Set(cardIds)));
  }, []);

  const clipboardRef = useRef<{
    cards: CanvasCard[];
    frames: Record<string, ProjectSnapshotShapeFrame>;
  } | null>(null);

  const copySelectedCanvasCards = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || typeof editor.getSelectedShapeIds !== 'function') {
      return false;
    }

    const selectedCardIds = editor
      .getSelectedShapeIds()
      .filter(
        (shapeId) =>
          canvasCardsRef.current[shapeId]?.kind !== 'output' &&
          Boolean(canvasCardsRef.current[shapeId])
      );
    if (selectedCardIds.length === 0) {
      return false;
    }

    const frames: Record<string, ProjectSnapshotShapeFrame> = {};
    for (const cardId of selectedCardIds) {
      const bounds = editor.getShapePageBounds(cardId as never);
      if (bounds) {
        frames[cardId] = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
      }
    }

    clipboardRef.current = {
      cards: selectedCardIds.map(
        (cardId) => canvasCardsRef.current[cardId] as CanvasCard
      ),
      frames,
    };
    return true;
  }, [canvasCardsRef]);

  const pasteCanvasCards = useCallback(() => {
    const clipboard = clipboardRef.current;
    const editor = editorRef.current;
    if (!clipboard || clipboard.cards.length === 0 || !editor) {
      return false;
    }

    recordCanvasHistory();

    const PASTE_OFFSET = 32;
    const idMap = new Map<string, string>();
    for (const card of clipboard.cards) {
      idMap.set(card.id, `shape:${makeId()}`);
    }

    const remapReferences = (referenceCardIds: string[]) =>
      Array.from(
        new Set(
          referenceCardIds
            .map((referenceCardId) => {
              if (idMap.has(referenceCardId)) {
                return idMap.get(referenceCardId) as string;
              }
              return canvasCardsRef.current[referenceCardId]
                ? referenceCardId
                : null;
            })
            .filter((cardId): cardId is string => Boolean(cardId))
        )
      );

    const pastedCardIds: string[] = [];
    for (const card of clipboard.cards) {
      const nextId = idMap.get(card.id) as string;
      const frame = clipboard.frames[card.id];
      const nextFrame = frame
        ? {
            ...frame,
            x: frame.x + PASTE_OFFSET,
            y: frame.y + PASTE_OFFSET,
          }
        : undefined;

      if (card.kind === 'generation') {
        const nextReferences = remapReferences(card.referenceCardIds);
        createDraftCard({
          taskType: card.type,
          prompt: card.prompt,
          referenceCardIds: nextReferences,
          workflowTemplateId: card.workflowTemplateId,
          presetName: card.name,
          aspectRatio: card.aspectRatio,
          language: card.language,
          shapeId: nextId,
          frame: nextFrame,
          existingCard: {
            ...card,
            id: nextId,
            kind: 'generation',
            referenceCardIds: nextReferences,
            status: 'idle',
            error: null,
            pinnedOutputId: null,
          },
          connectReferences: true,
          activateOnInsert: false,
          recordHistory: false,
        });
        pastedCardIds.push(nextId);
        continue;
      }

      if (card.kind === 'asset') {
        insertAssetCard({
          type: card.type,
          url: card.url ?? '',
          name: card.name,
          kind: 'asset',
          assetId: card.assetId,
          sourceGenerationId: card.sourceGenerationId,
          sourceCardIds: [],
          shapeId: nextId,
          frame: nextFrame,
          existingCard: {
            ...card,
            id: nextId,
            referenceCardIds: [],
          },
          activateOnInsert: false,
          recordHistory: false,
        });
        pastedCardIds.push(nextId);
      }
    }

    if (pastedCardIds.length > 0) {
      focusShapes(pastedCardIds);
    }
    return true;
  }, [
    canvasCardsRef,
    createDraftCard,
    focusShapes,
    insertAssetCard,
    recordCanvasHistory,
  ]);

  return {
    buildProjectSnapshotDocument,
    canUndoCanvas: historyState.canUndo,
    canRedoCanvas: historyState.canRedo,
    recordCanvasHistory,
    undoCanvas,
    redoCanvas,
    createConnectorBetweenCards,
    removeConnectorBetweenCards,
    copySelectedCanvasCards,
    pasteCanvasCards,
    createGenerationOutput,
    updateGenerationOutput,
    completeGenerationOutput,
    deleteCanvasCard,
    createDraftCard,
    editorRef,
    focusShape,
    focusShapes,
    getViewportCenter,
    groupShapes,
    handleSelectShape,
    insertAssetCard,
    restoreProjectSnapshot,
    bringCanvasCardsToFront,
    updateCanvasCardFrame,
  };
}
