'use client';

import type { CanvasCardMediaType } from '@/core/beatcanvas/canvas-types';
import { ImageIcon, Plus, Upload, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useCanvasEngine,
  useCanvasEngineValue,
} from './canvas-engine/canvas-engine-context';
import {
  ASSET_CARD_NODE_TYPE,
  GENERATION_CARD_NODE_TYPE,
} from './react-flow/beatcanvas-react-flow-types';
import { useCanvasFrontLayer } from './beatcanvas-front-layer-context';

type Side = 'input' | 'output';

interface DragState {
  sourceId: string;
  sourceSide: Side;
  startX: number;
  startY: number;
}

interface CreateMenuState {
  sourceId: string | null;
  pagePoint: { x: number; y: number };
  viewportPoint: { x: number; y: number };
}

const PORT_SIZE = 16;
const PORT_ACTIVE_SIZE = 22;
const MENU_WIDTH = 276;

const isCardShapeType = (shapeType: string) =>
  shapeType === ASSET_CARD_NODE_TYPE ||
  shapeType === GENERATION_CARD_NODE_TYPE;

export function CardConnectorOverlay() {
  const { editor } = useCanvasEngine();
  const {
    cards,
    labels,
    onUploadImage,
    onCreateGenerationFromConnector,
    onCreateGenerationAtPoint,
  } = useCanvasFrontLayer();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredConnectorKey, setHoveredConnectorKey] = useState<string | null>(
    null
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [createMenu, setCreateMenu] = useState<CreateMenuState | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIds = useCanvasEngineValue(
    (currentEditor) => currentEditor.getSelectedShapeIds(),
    [cards]
  );

  const findCardShapeAtPoint = useCallback(
    (point: { x: number; y: number }, excludeShapeId?: string) =>
      editor
        .getShapesAtPoint(point)
        .find(
          (shape) => isCardShapeType(shape.type) && shape.id !== excludeShapeId
        ) ?? null,
    [editor]
  );

  // Track hovered shape via pointer events on the editor container
  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    const handleMove = (e: PointerEvent) => {
      if (drag) {
        const rect = container.getBoundingClientRect();
        setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }

      const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const cardShape = findCardShapeAtPoint(point);
      setHoveredId(cardShape ? cardShape.id : null);
    };

    const handleUp = (e: PointerEvent) => {
      if (!drag) return;
      const rect = container.getBoundingClientRect();
      const nextDragPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Find card under cursor
      const point = editor.screenToPage({
        x: e.clientX,
        y: e.clientY,
      });

      const targetCard = findCardShapeAtPoint(point, drag.sourceId);

      if (targetCard) {
        // Determine target side based on where the cursor is relative to target card center
        const targetBounds = editor.getShapePageBounds(targetCard.id);
        if (targetBounds) {
          const targetSide: Side =
            point.x < (targetBounds.minX + targetBounds.maxX) / 2
              ? 'input'
              : 'output';

          // Only connect output→input
          if (drag.sourceSide === 'output' && targetSide === 'input') {
            // Dispatch custom event for the canvas graph to handle
            window.dispatchEvent(
              new CustomEvent('beatcanvas:connect-cards', {
                detail: {
                  sourceCardId: drag.sourceId,
                  targetCardId: targetCard.id,
                },
              })
            );
          }
        }
      } else if (drag.sourceSide === 'output') {
        setCreateMenu({
          sourceId: drag.sourceId,
          pagePoint: point,
          viewportPoint: {
            x: nextDragPos.x,
            y: nextDragPos.y,
          },
        });
      }

      setDrag(null);
      setDragPos(null);
    };

    container.addEventListener('pointermove', handleMove);
    container.addEventListener('pointerup', handleUp);
    return () => {
      container.removeEventListener('pointermove', handleMove);
      container.removeEventListener('pointerup', handleUp);
    };
  }, [editor, drag, dragPos, findCardShapeAtPoint]);

  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    const openBlankMenu = (clientX: number, clientY: number) => {
      const pagePoint = editor.screenToPage({ x: clientX, y: clientY });
      if (findCardShapeAtPoint(pagePoint)) return;
      const rect = container.getBoundingClientRect();
      setCreateMenu({
        sourceId: null,
        pagePoint,
        viewportPoint: {
          x: clientX - rect.left,
          y: clientY - rect.top,
        },
      });
    };

    const handleDoubleClick = (event: MouseEvent) => {
      openBlankMenu(event.clientX, event.clientY);
    };
    const handleContextMenu = (event: MouseEvent) => {
      const pagePoint = editor.screenToPage({
        x: event.clientX,
        y: event.clientY,
      });
      if (findCardShapeAtPoint(pagePoint)) {
        return;
      }
      event.preventDefault();
      openBlankMenu(event.clientX, event.clientY);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      const rect = container.getBoundingClientRect();
      event.preventDefault();
      openBlankMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
    };

    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, findCardShapeAtPoint]);

  useEffect(() => {
    if (!createMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }

      setCreateMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateMenu(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [createMenu]);

  // Active card IDs = hovered or selected
  const activeIds = new Set<string>();
  for (const id of selectedIds) {
    if (cards[id]) activeIds.add(id);
  }
  if (hoveredId && cards[hoveredId]) activeIds.add(hoveredId);

  const getButtonPosition = useCallback(
    (shapeId: string, side: Side) => {
      const bounds = editor.getShapePageBounds(shapeId as any);
      if (!bounds) return null;
      const cx = side === 'input' ? bounds.minX : bounds.maxX;
      const cy = (bounds.minY + bounds.maxY) / 2;
      const vp = editor.pageToViewport({ x: cx, y: cy });
      return { x: vp.x, y: vp.y };
    },
    [editor]
  );

  const handleConnectorDown = (
    shapeId: string,
    side: Side,
    e: React.PointerEvent
  ) => {
    if (side !== 'output') {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    const rect = editor.getContainer().getBoundingClientRect();
    setCreateMenu(null);
    setDrag({
      sourceId: shapeId,
      sourceSide: side,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
    });
    setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCreateFromMenu = (taskType: CanvasCardMediaType) => {
    if (!createMenu) return;

    if (createMenu.sourceId) {
      onCreateGenerationFromConnector({
        sourceCardId: createMenu.sourceId,
        taskType,
        pagePoint: createMenu.pagePoint,
      });
    } else {
      onCreateGenerationAtPoint({
        taskType,
        pagePoint: createMenu.pagePoint,
      });
    }
    setCreateMenu(null);
  };

  // Render connector buttons for active cards
  const connectors: React.ReactNode[] = [];
  for (const shapeId of activeIds) {
    for (const side of ['input', 'output'] as Side[]) {
      const pos = getButtonPosition(shapeId, side);
      if (!pos) continue;
      const connectorKey = `${shapeId}-${side}`;
      const isInteractive = side === 'output';
      const isHovered = hoveredConnectorKey === connectorKey;
      const isDraggingSource =
        drag?.sourceId === shapeId && drag.sourceSide === side;
      const size = isHovered || isDraggingSource ? PORT_ACTIVE_SIZE : PORT_SIZE;

      connectors.push(
        <div
          key={connectorKey}
          style={{
            position: 'absolute',
            left: pos.x - size / 2,
            top: pos.y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--beat-surface)',
            border: `1.5px solid ${
              isHovered || isDraggingSource
                ? 'var(--beat-graph)'
                : 'rgba(255,255,255,0.24)'
            }`,
            color: isHovered || isDraggingSource
              ? 'var(--beat-graph)'
              : 'var(--beat-text-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1,
            cursor: isInteractive ? 'grab' : 'default',
            pointerEvents: isInteractive ? 'auto' : 'none',
            boxShadow:
              isHovered || isDraggingSource
                ? '0 7px 18px rgba(127,176,242,0.34), 0 1px 0 rgba(255,255,255,0.08) inset'
                : '0 4px 12px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.05) inset',
            zIndex: 30,
            transition:
              'width 120ms ease, height 120ms ease, left 120ms ease, top 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
          }}
          onPointerEnter={() => setHoveredConnectorKey(connectorKey)}
          onPointerLeave={() =>
            setHoveredConnectorKey((current) =>
              current === connectorKey ? null : current
            )
          }
          onPointerDown={(e) => handleConnectorDown(shapeId, side, e)}
          aria-label={
            side === 'output' ? labels.createGenerationCardLabel : undefined
          }
        >
          {(isHovered || isDraggingSource) && (
            <Plus aria-hidden="true" size={13} strokeWidth={2.4} />
          )}
        </div>
      );
    }
  }

  // Render drag line
  let dragLine: React.ReactNode = null;
  if (drag && dragPos) {
    const startPos = getButtonPosition(drag.sourceId, drag.sourceSide);
    if (startPos) {
      dragLine = (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 25,
          }}
          width="100%"
          height="100%"
        >
          <line
            x1={startPos.x}
            y1={startPos.y}
            x2={dragPos.x}
            y2={dragPos.y}
            stroke="var(--beat-graph)"
            strokeWidth={2}
            strokeDasharray="7 7"
            strokeLinecap="round"
            opacity={0.72}
          />
        </svg>
      );
    }
  }

  const menuLeft = createMenu
    ? Math.max(12, createMenu.viewportPoint.x + 14)
    : 0;
  const menuTop = createMenu
    ? Math.max(12, createMenu.viewportPoint.y - 42)
    : 0;

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 20 }}
    >
      {connectors}
      {dragLine}
      {createMenu && (
        <div
          ref={menuRef}
          className="pointer-events-auto absolute overflow-hidden rounded-[var(--beat-radius-sm)] border border-white/10 bg-[var(--beat-surface-2)]/95 p-1.5 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          style={{
            left: menuLeft,
            top: menuTop,
            width: MENU_WIDTH,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              aria-label={labels.createImageGenerationCardLabel}
              className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[12px] font-semibold text-[var(--beat-text-1)] transition hover:bg-[var(--beat-accent)]/10 hover:text-[#ff9a62]"
              onClick={() => handleCreateFromMenu('image')}
            >
              <ImageIcon aria-hidden="true" size={15} strokeWidth={2} />
              {labels.imageModeLabel}
            </button>
            <button
              type="button"
              aria-label={labels.createVideoGenerationCardLabel}
              className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[12px] font-semibold text-[var(--beatcanvas-ink)] transition hover:bg-white/[0.06]"
              onClick={() => handleCreateFromMenu('video')}
            >
              <Video aria-hidden="true" size={15} strokeWidth={2} />
              {labels.videoModeLabel}
            </button>
            <button
              type="button"
              aria-label={labels.uploadImageLabel}
              className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[12px] font-semibold text-[var(--beatcanvas-ink)] transition hover:bg-white/[0.06]"
              onClick={() => {
                onUploadImage();
                setCreateMenu(null);
              }}
            >
              <Upload aria-hidden="true" size={15} strokeWidth={2} />
              {labels.connectorUploadLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
