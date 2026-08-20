'use client';

import type { WorkspaceModelOption } from '@/core/effects/workspace-models';

import { useBeatCanvasState } from './use-beatcanvas-state';
import { useBeatCanvasReactFlowAdapter } from './use-beatcanvas-react-flow-adapter';
import type { StudioTranslateFn } from './beatcanvas-types';

export function useBeatCanvasGraph({
  studioT,
  imageModels,
  videoModels,
  initialImageModelId,
  initialVideoModelId,
}: {
  studioT: StudioTranslateFn;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  initialImageModelId: string | null;
  initialVideoModelId: string | null;
}) {
  const canvasState = useBeatCanvasState();
  const reactFlowAdapter = useBeatCanvasReactFlowAdapter({
    studioT,
    imageModels,
    videoModels,
    initialImageModelId,
    initialVideoModelId,
    canvasCards: canvasState.canvasCards,
    canvasCardsRef: canvasState.canvasCardsRef,
    removeCanvasCard: canvasState.removeCanvasCard,
    replaceCanvasCards: canvasState.replaceCanvasCards,
    setCanvasCard: canvasState.setCanvasCard,
    setActiveComposerCardId: canvasState.setActiveComposerCardId,
  });

  return {
    ...canvasState,
    ...reactFlowAdapter,
  };
}
