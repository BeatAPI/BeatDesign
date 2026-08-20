'use client';

import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
} from '@xyflow/react';
import type { MouseEvent } from 'react';

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
  const canPreviewImage =
    cardMediaType === 'image' &&
    Boolean(thumbnailUrl) &&
    !thumbnailUrl.startsWith('data:image/svg+xml');

  const handlePreviewImage = (event: MouseEvent<HTMLImageElement>) => {
    if (!canPreviewImage || typeof window === 'undefined') return;
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('beatcanvas:preview-media', {
        detail: {
          type: 'image',
          url: thumbnailUrl,
          title: title || shapeCopy.image,
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
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            draggable={false}
            onDoubleClick={handlePreviewImage}
            className="nodrag nowheel"
            style={{
              width: '100%',
              height: '100%',
              objectFit: isContain ? 'contain' : 'cover',
              display: 'block',
              cursor: canPreviewImage ? 'zoom-in' : 'default',
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
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
    </>
  );
}
