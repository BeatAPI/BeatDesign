import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

import type { BeatCanvasFlowEdge } from './beatcanvas-react-flow-types';

export function BeatCanvasReferenceEdge(props: EdgeProps<BeatCanvasFlowEdge>) {
  const lineageRole = props.data?.beatdesignLineageRole;
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
  const stroke =
    lineageRole === 'upstream'
      ? 'var(--beat-graph)'
      : lineageRole === 'downstream'
        ? 'var(--beat-accent)'
        : 'rgba(214, 222, 232, 0.78)';
  const opacity =
    lineageRole === 'dimmed'
      ? 0.22
      : props.selected || isLineageEdge
        ? 1
        : 0.92;

  return (
    <>
      <BaseEdge
        path={path}
        interactionWidth={0}
        style={{
          stroke,
          strokeWidth: isLineageEdge ? 7 : 5,
          strokeLinecap: 'round',
          opacity: opacity * 0.22,
          filter: 'blur(2.2px)',
          transition: 'stroke 160ms ease, opacity 160ms ease',
        }}
      />
      <BaseEdge
        id={props.id}
        path={path}
        interactionWidth={18}
        style={{
          stroke,
          strokeWidth: isLineageEdge ? 2.4 : 1.85,
          strokeDasharray: '6 8',
          strokeLinecap: 'round',
          opacity,
          transition: 'stroke 160ms ease, opacity 160ms ease',
        }}
      />
    </>
  );
}
