'use client';

import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
  useInternalNode,
} from '@xyflow/react';
import { Sparkles } from 'lucide-react';

import type { GenerationTake } from '@/core/beatcanvas/generation-history';

import { getBeatCanvasNodeCopy } from './beatcanvas-node-copy';
import type { BeatCanvasFlowNode } from '../react-flow/beatcanvas-react-flow-types';

const MAX_VISIBLE_TAKES = 6;

const CARD_RADIUS = 16;
const CARD_BORDER_COLOR = 'var(--beatcanvas-line)';
const FRAME_BACKGROUND =
  'linear-gradient(180deg, var(--beat-surface-2) 0%, var(--beat-surface) 100%)';
const PLACEHOLDER_COLOR = 'rgba(255, 255, 255, 0.22)';

export function GenerationCardNode({
  id,
  data,
  selected,
}: NodeProps<BeatCanvasFlowNode>) {
  const props = data.props;
  const internalNode = useInternalNode(id);
  if (!('status' in props)) return null;

  const {
    w,
    h,
    cardMediaType,
    label,
    status,
    latestOutputUrl = null,
    takes = [],
  } = props;
  const isBusy = status === 'pending' || status === 'processing';
  const isFailed = status === 'failed';
  const hasResult = Boolean(latestOutputUrl);
  const isEmptySlot = !hasResult && !isFailed;
  const emptySlotAccent =
    cardMediaType === 'video' ? 'var(--beat-graph)' : 'var(--beat-accent)';
  const emptySlotBorder =
    cardMediaType === 'video'
      ? 'rgba(127, 176, 242, 0.62)'
      : 'rgba(255, 122, 51, 0.62)';
  const emptySlotGlow =
    cardMediaType === 'video'
      ? 'inset 0 0 0 1px rgba(127, 176, 242, 0.14), 0 0 22px rgba(127, 176, 242, 0.12)'
      : 'inset 0 0 0 1px rgba(255, 122, 51, 0.14), 0 0 22px rgba(255, 122, 51, 0.12)';
  const shapeCopy = getBeatCanvasNodeCopy();
  const isInsideGroup = Boolean(internalNode?.parentId);
  const displayLabel =
    label ||
    (cardMediaType === 'image'
      ? shapeCopy.imageGeneration
      : shapeCopy.videoGeneration);
  const isCompactActionNode = w <= 128 && h <= 128;
  const visibleTakes = takes.slice(-MAX_VISIBLE_TAKES);
  const showTakeStrip =
    !isCompactActionNode &&
    (takes.length > 1 || (isBusy && takes.length > 0));

  const handlePinTake = (take: GenerationTake) => {
    if (!take.url || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('beatcanvas:pin-generation-output', {
        detail: { draftId: id, outputId: take.id },
      })
    );
    window.dispatchEvent(
      new CustomEvent('beatcanvas:preview-media', {
        detail: {
          type: take.type,
          url: take.url,
          title: `${displayLabel} ${take.takeNumber}`,
        },
      })
    );
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={48}
        minHeight={48}
        lineClassName="!border-[var(--beat-graph)]"
        handleClassName="!size-2.5 !border-[var(--beat-graph)] !bg-[var(--beat-surface)]"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
      <div
        data-card-id={id}
        className="group cursor-grab active:cursor-grabbing"
        style={{
          width: w,
          height: h,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {!isInsideGroup && !isCompactActionNode && (
          <div
            style={{
              position: 'absolute',
              top: -25,
              left: 0,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: selected ? 'var(--beat-graph)' : 'var(--beat-text-2)',
              lineHeight: '18px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            <Sparkles aria-hidden="true" size={14} strokeWidth={1.8} />
            {displayLabel}
          </div>
        )}

        {isCompactActionNode ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              aria-label={displayLabel}
              style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
              background:
                'linear-gradient(135deg, var(--beat-accent) 0%, var(--beat-graph) 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 12px 28px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <svg
                width="27"
                height="27"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
                style={{ display: 'block', marginLeft: 3 }}
              >
                <path
                  d="M10.5 7.8L24 16L10.5 24.2V7.8Z"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: CARD_RADIUS,
              background: isFailed
                ? 'rgba(255,107,115,0.10)'
                : FRAME_BACKGROUND,
              border: isFailed
                ? '1px solid var(--beatcanvas-error)'
                : isEmptySlot
                  ? `1.5px dashed ${emptySlotBorder}`
                  : `1px solid ${CARD_BORDER_COLOR}`,
              boxSizing: 'border-box',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: selected
                ? '0 0 0 2px rgba(127,176,242,0.20), 0 16px 38px rgba(0,0,0,0.36)'
                : isEmptySlot
                  ? emptySlotGlow
                  : isInsideGroup
                    ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 18px rgba(0,0,0,0.22)'
                    : '0 14px 32px rgba(0,0,0,0.3)',
            }}
          >
            {isInsideGroup ? (
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  zIndex: 2,
                  borderRadius: 999,
                  background: 'var(--beat-graph-soft)',
                  border: '1px solid rgba(127,176,242,0.28)',
                  color: 'var(--beat-graph)',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: '18px',
                  padding: '0 8px',
                  letterSpacing: 0.4,
                }}
              >
                AI
              </div>
            ) : null}
            {hasResult ? (
              cardMediaType === 'video' ? (
                <video
                  src={latestOutputUrl ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="nowheel"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <img
                  src={latestOutputUrl ?? undefined}
                  alt={displayLabel}
                  draggable={false}
                  className="nowheel"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              )
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <svg
                  width="86"
                  height="64"
                  viewBox="0 0 104 76"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    maxWidth: isInsideGroup ? '26%' : '24%',
                    height: 'auto',
                    color: isFailed
                      ? 'rgba(255,107,115,0.22)'
                      : isEmptySlot
                        ? emptySlotAccent
                        : PLACEHOLDER_COLOR,
                    opacity: isEmptySlot ? 0.42 : isInsideGroup ? 0.72 : 1,
                  }}
                >
                  <circle cx="72.5" cy="17.5" r="8.5" fill="currentColor" />
                  <path
                    d="M8.55 64.5C5.95 64.5 4.34 61.71 5.64 59.47L39.26 10.48C40.54 8.28 43.72 8.28 45 10.48L67.12 48.44L75.04 35.66C76.37 33.52 79.52 33.58 80.77 35.77L99.3 59.61C100.55 61.86 98.93 64.5 96.37 64.5H8.55Z"
                    fill="currentColor"
                  />
                </svg>
                {isFailed && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--beatcanvas-error)',
                      fontWeight: 500,
                    }}
                  >
                    {shapeCopy.generationFailed}
                  </div>
                )}
              </div>
            )}

            {isBusy && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  border: '1px solid rgba(127,176,242,0.28)',
                  background: 'var(--beatcanvas-panel)',
                  padding: '6px 9px',
                  color: 'var(--beat-graph)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 11,
                    height: 11,
                    border: '2px solid rgba(127,176,242,0.24)',
                    borderTopColor: 'var(--beat-graph)',
                    borderRadius: '50%',
                    animation: 'beatcanvas-spin 0.8s linear infinite',
                  }}
                />
                {status === 'processing'
                  ? shapeCopy.processing
                  : shapeCopy.pending}
              </div>
            )}

          </div>
        )}

        {showTakeStrip ? (
          <div
            className="nodrag nopan nowheel"
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              left: '100%',
              top: 0,
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginLeft: 8,
              pointerEvents: 'auto',
            }}
          >
            {visibleTakes.map((take) => {
              const isPending =
                take.status === 'pending' || take.status === 'processing';
              return (
                <button
                  key={take.id}
                  type="button"
                  disabled={!take.url}
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePinTake(take);
                  }}
                  aria-label={`Take ${take.takeNumber}`}
                  aria-pressed={take.isPinned}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    overflow: 'hidden',
                    borderRadius: 8,
                    border: take.isPinned
                      ? '1.5px solid var(--beat-graph)'
                      : '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--beat-surface)',
                    boxShadow: take.isPinned
                      ? '0 0 0 2px rgba(127,176,242,0.22)'
                      : '0 6px 14px rgba(0,0,0,0.28)',
                    padding: 0,
                    cursor: take.url ? 'pointer' : 'default',
                    opacity: take.status === 'failed' ? 0.55 : 1,
                  }}
                >
                  {take.url && take.type === 'video' ? (
                    <video
                      src={take.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="nowheel"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : take.url ? (
                    <img
                      src={take.url}
                      alt=""
                      draggable={false}
                      className="nowheel"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: '100%',
                        height: '100%',
                        color: 'var(--beat-text-3)',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {isPending ? '…' : take.takeNumber}
                    </span>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      right: 3,
                      bottom: 3,
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.62)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      lineHeight: '12px',
                      padding: '0 3px',
                    }}
                  >
                    {take.takeNumber}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
    </>
  );
}
