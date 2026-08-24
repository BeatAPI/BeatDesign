'use client';

import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
} from '@xyflow/react';
import { useEffect, useState, type MouseEvent } from 'react';

import { getBeatCanvasNodeCopy } from './beatcanvas-node-copy';
import type { BeatCanvasFlowNode } from '../react-flow/beatcanvas-react-flow-types';

const CARD_RADIUS = 8;

export function AssetCardNode({
  id,
  data,
  selected,
}: NodeProps<BeatCanvasFlowNode>) {
  const props = data.props;
  if (!('thumbnailUrl' in props)) return null;

  const { w, h, cardMediaType, title, thumbnailUrl, fitMode, chromeMode } =
    props;
  const shapeCopy = getBeatCanvasNodeCopy();
  const isContain = fitMode === 'contain';
  const isFrameless = chromeMode === 'frameless';
  const hasOuterChrome = !isFrameless;
  const [mediaStatus, setMediaStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >(thumbnailUrl ? 'loading' : 'idle');

  useEffect(() => {
    setMediaStatus(thumbnailUrl ? 'loading' : 'idle');
  }, [cardMediaType, thumbnailUrl]);
  const canPreviewMedia =
    Boolean(thumbnailUrl) &&
    (cardMediaType === 'video' ||
      !thumbnailUrl.startsWith('data:image/svg+xml'));

  const handlePreviewMedia = (event: MouseEvent<HTMLElement>) => {
    if (!canPreviewMedia || typeof window === 'undefined') return;
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('beatcanvas:preview-media', {
        detail: {
          type: cardMediaType,
          url: thumbnailUrl,
          title:
            title ||
            (cardMediaType === 'video' ? shapeCopy.video : shapeCopy.image),
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
          borderRadius: CARD_RADIUS,
          background: hasOuterChrome
            ? 'var(--beat-surface)'
            : 'transparent',
          border: selected
            ? '2px solid var(--beat-graph)'
            : hasOuterChrome
              ? '1px solid rgba(255, 255, 255, 0.10)'
              : '1px solid transparent',
          boxShadow: selected
            ? '0 0 0 3px rgba(127,176,242,0.18)'
            : hasOuterChrome && thumbnailUrl
              ? '0 14px 34px rgba(0,0,0,0.34)'
              : 'none',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {!thumbnailUrl && (
          <div
            style={{
              position: 'absolute',
              top: 5,
              left: 5,
              zIndex: 3,
              fontSize: 9,
              fontWeight: 500,
              color: 'var(--beat-text-3)',
              padding: '1px 6px',
              borderRadius: 3,
              lineHeight: '14px',
            }}
          >
            {title ||
              (cardMediaType === 'video' ? shapeCopy.video : shapeCopy.image)}
          </div>
        )}
        {thumbnailUrl && mediaStatus === 'error' ? (
          <div
            className="grid size-full place-items-center px-4 text-center text-xs text-[var(--beat-text-3)]"
            role="status"
          >
            {shapeCopy.previewUnavailable}
          </div>
        ) : thumbnailUrl && cardMediaType === 'video' ? (
          <>
            <video
              src={thumbnailUrl}
              aria-label={title}
              muted
              playsInline
              preload="metadata"
              draggable={false}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                if (video.duration > 0 && video.currentTime === 0) {
                  video.currentTime = Math.min(0.05, video.duration / 2);
                }
              }}
              onLoadedData={() => setMediaStatus('ready')}
              onError={() => setMediaStatus('error')}
              onDoubleClick={handlePreviewMedia}
              className="nowheel"
              style={{
                width: '100%',
                height: '100%',
                objectFit: isContain ? 'contain' : 'cover',
                display: 'block',
                cursor: 'zoom-in',
                borderRadius: CARD_RADIUS - 1,
                padding: 0,
                boxSizing: 'border-box',
              }}
            />
            {mediaStatus === 'ready' ? (
              <button
                type="button"
                aria-label={`${shapeCopy.viewResult}: ${
                  title || shapeCopy.video
                }`}
                className="nodrag nopan nowheel absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/65 text-lg text-white opacity-80 shadow-lg transition-[opacity,transform,background-color] hover:scale-105 hover:bg-black/80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--beat-graph)] group-hover:opacity-100"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handlePreviewMedia}
              >
                <span aria-hidden="true" className="ml-0.5">
                  ▶
                </span>
              </button>
            ) : null}
          </>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            draggable={false}
            onLoad={() => setMediaStatus('ready')}
            onError={() => setMediaStatus('error')}
            onDoubleClick={handlePreviewMedia}
            className="nowheel"
            style={{
              width: '100%',
              height: '100%',
              objectFit: isContain ? 'contain' : 'cover',
              display: 'block',
              cursor: canPreviewMedia ? 'zoom-in' : 'default',
              borderRadius: CARD_RADIUS - 1,
              padding: 0,
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--beat-text-3)',
              fontSize: 13,
            }}
          >
            {cardMediaType === 'video'
              ? `▶ ${shapeCopy.video}`
              : `🖼 ${shapeCopy.image}`}
          </div>
        )}
        {thumbnailUrl && mediaStatus === 'loading' ? (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25 px-3 text-center text-[11px] text-white/80"
            role="status"
          >
            {shapeCopy.previewLoading}
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
