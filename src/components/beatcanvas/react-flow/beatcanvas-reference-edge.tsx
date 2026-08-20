'use client';

import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

import type { BeatCanvasFlowEdge } from './beatcanvas-react-flow-types';

export function BeatCanvasReferenceEdge(props: EdgeProps<BeatCanvasFlowEdge>) {
  const lineageRole = props.data?.visugenLineageRole;
  const isLineageEdge =
    lineageRole === 'upstream' || lineageRole === 'downstream';
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.34,
  });

  return (
    <BaseEdge
      id={props.id}
      path={path}
      interactionWidth={18}
      style={{
        stroke:
          lineageRole === 'upstream'
            ? 'var(--beat-graph)'
            : lineageRole === 'downstream'
              ? 'var(--beat-accent)'
              : 'var(--beat-text-3)',
        strokeWidth: isLineageEdge ? 2.4 : 1.5,
        strokeDasharray: '7 7',
        opacity:
          lineageRole === 'dimmed'
            ? 0.12
            : props.selected || isLineageEdge
              ? 0.98
              : 0.7,
        transition: 'stroke 160ms ease, opacity 160ms ease',
      }}
    />
  );
}
