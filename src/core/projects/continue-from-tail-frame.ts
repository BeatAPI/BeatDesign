import { createHash } from 'node:crypto';

import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { persistExternalCommandWithConflictRetry } from '@/core/commands/conflict-retry';
import { createCommandId } from '@/core/commands/contracts';
import {
  extractProjectVideoFrame,
  removeExtractedProjectVideoFrame,
} from '@/core/projects/extract-project-video-frame';
import { loadProjectWithLatestSnapshot } from '@/core/projects/projects';

const DEFAULT_VIDEO_MODEL_ID = 'seedance-2';

export const createTailContinuationIdentity = ({
  projectId,
  commandId,
}: {
  projectId: string;
  commandId: string;
}) => {
  const token = createHash('sha256')
    .update(`${projectId}\0${commandId}`)
    .digest('hex')
    .slice(0, 32);
  return {
    frameAssetId: `frame-${token}`,
    generationCardId: `shape:continue-${token}`,
  };
};

type ContinueFromTailFrameDependencies = {
  loadProjectState: typeof loadProjectWithLatestSnapshot;
  extractFrame: typeof extractProjectVideoFrame;
  removeFrame: typeof removeExtractedProjectVideoFrame;
  persistCommand: typeof persistExternalCommandWithConflictRetry;
};

const defaultDependencies: ContinueFromTailFrameDependencies = {
  loadProjectState: loadProjectWithLatestSnapshot,
  extractFrame: extractProjectVideoFrame,
  removeFrame: removeExtractedProjectVideoFrame,
  persistCommand: persistExternalCommandWithConflictRetry,
};

export type ContinueFromTailFrameInput = {
  projectId: string;
  sourceCardId?: string;
  assetId?: string;
  prompt?: string;
  modelId?: string;
  position?: 'first' | 'last' | number;
  commandId?: string;
  expectedRevision?: number | null;
};

const inFlightContinuations = new Map<string, Promise<unknown>>();

const placeRightOf = (
  frame: { x: number; y: number; w: number; h: number } | undefined,
  size: { w: number; h: number },
  gap = 64
) => ({
  x: (frame?.x ?? 80) + (frame?.w ?? 360) + gap,
  y: frame?.y ?? 80,
  w: size.w,
  h: size.h,
});

async function continueFromTailFrameOnce({
  projectId,
  sourceCardId,
  assetId,
  prompt = '',
  modelId,
  position = 'last',
  commandId = createCommandId(),
  expectedRevision,
}: ContinueFromTailFrameInput & { commandId: string }, dependencies: ContinueFromTailFrameDependencies) {
  const state = await dependencies.loadProjectState({ projectId });
  if (!state) throw new Error('Project not found.');

  const sourceCard = sourceCardId
    ? state.snapshot.cards.find((card) => card.id === sourceCardId)
    : assetId
      ? state.snapshot.cards.find((card) => card.assetId === assetId)
      : undefined;
  const sourceAssetId = sourceCard?.assetId ?? assetId;
  if (!sourceAssetId) {
    throw new Error('Provide a video canvas card or assetId to continue from.');
  }

  const identity = createTailContinuationIdentity({ projectId, commandId });
  const resolvedModelId =
    modelId?.trim() ||
    (sourceCard?.type === 'video' && sourceCard.modelId) ||
    DEFAULT_VIDEO_MODEL_ID;
  const existingContinuation = state.snapshot.cards.find(
    (card) => card.id === identity.generationCardId
  );
  if (
    existingContinuation &&
    (existingContinuation.prompt !== prompt.trim() ||
      existingContinuation.modelId !== resolvedModelId)
  ) {
    throw new Error(
      'This continuation command ID is already bound to different generation settings.'
    );
  }
  const frameAsset = await dependencies.extractFrame({
    projectId,
    assetId: sourceAssetId,
    position,
    derivedAssetId: identity.frameAssetId,
    purpose: 'continuation_first_frame',
  });

  const sourceFrame = sourceCard ? state.snapshot.frames[sourceCard.id] : undefined;
  const ratio = frameAsset.width / Math.max(1, frameAsset.height);
  const maxEdge = 280;
  const tailSize =
    ratio >= 1
      ? { w: maxEdge, h: Math.round(maxEdge / ratio) }
      : { w: Math.round(maxEdge * ratio), h: maxEdge };
  const tailFrameCardId = `asset:${frameAsset.id}`;
  const generationCardId = identity.generationCardId;
  const tailFrame = placeRightOf(sourceFrame, tailSize);
  const generationFrame = placeRightOf(tailFrame, { w: 360, h: 220 });
  const tailCard: CanvasCard = {
    id: tailFrameCardId,
    assetId: frameAsset.id,
    kind: 'asset',
    type: 'image',
    name: `${sourceCard?.name || 'Video'} tail frame`,
    url: frameAsset.publicUrl,
    prompt: '',
    referenceCardIds: sourceCard ? [sourceCard.id] : [],
    workflowTemplateId: null,
    status: 'succeeded',
    error: null,
    modelId: '',
    aspectRatio: sourceCard?.aspectRatio ?? '16:9',
    outputQuality: '1k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    sourceGenerationId: sourceCard?.sourceGenerationId ?? null,
  };
  const generationCard: CanvasCard = {
    id: generationCardId,
    kind: 'generation',
    type: 'video',
    name: 'Continue shot',
    url: null,
    prompt: prompt.trim(),
    referenceCardIds: [tailFrameCardId],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    modelId: resolvedModelId,
    aspectRatio: sourceCard?.aspectRatio ?? '16:9',
    outputQuality: sourceCard?.outputQuality ?? '720p',
    duration: sourceCard?.duration ?? '5s',
    mode: sourceCard?.mode ?? 'quality',
    variant: sourceCard?.variant ?? 'standard',
    quality: sourceCard?.quality ?? 'standard',
    sourceGenerationId: null,
  };

  const applied = await dependencies.persistCommand({
    input: {
      projectId,
      origin: 'mcp',
      commandId,
      idempotencyKey: commandId,
      expectedRevision:
        typeof expectedRevision === 'number'
          ? expectedRevision
          : state.snapshotVersion,
      command: {
        type: 'canvas.apply',
        operations: [
          { type: 'upsert_card', card: tailCard, frame: tailFrame },
          { type: 'upsert_card', card: generationCard, frame: generationFrame },
        ],
      },
    },
  });
  if (!applied.ok) {
    let frameAssetRolledBack = false;
    if (!frameAsset.reused) {
      frameAssetRolledBack = await dependencies
        .removeFrame({ projectId, assetId: frameAsset.id })
        .catch(() => false);
    }
    return {
      ...applied,
      frameAssetRolledBack,
    };
  }

  return {
    ...applied,
    frameAsset,
    tailFrameCardId,
    generationCardId,
    modelId: resolvedModelId,
    review: {
      tool: 'bdesign_canvas_view',
      projectId,
      cardId: generationCardId,
    },
    next: {
      tool: 'bdesign_generation_submit',
      projectId,
      mode: 'video',
      modelId: resolvedModelId,
      prompt: prompt.trim(),
      references: [{ assetId: frameAsset.id, role: 'first_frame' }],
    },
  };
}

export function continueFromTailFrame(
  input: ContinueFromTailFrameInput,
  dependencies: ContinueFromTailFrameDependencies = defaultDependencies
) {
  const commandId = input.commandId?.trim() || createCommandId();
  const lockKey = `${input.projectId}:${commandId}`;
  const existing = inFlightContinuations.get(lockKey);
  if (existing) {
    return existing as ReturnType<typeof continueFromTailFrameOnce>;
  }
  const promise = continueFromTailFrameOnce(
    { ...input, commandId },
    dependencies
  ).finally(() => {
    if (inFlightContinuations.get(lockKey) === promise) {
      inFlightContinuations.delete(lockKey);
    }
  });
  inFlightContinuations.set(lockKey, promise);
  return promise;
}
