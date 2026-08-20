import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectSnapshotDocument,
  createProjectSnapshotRestorePlan,
  mergeCanvasRuntimeCardsIntoHistoryDocument,
} from '@/core/projects/project-canvas-document';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';

const assetCard: CanvasCard = {
  id: 'shape:source',
  kind: 'asset',
  type: 'image',
  name: 'Product reference',
  url: 'https://example.com/product.webp',
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: '',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
};

const generationCard: CanvasCard = {
  id: 'shape:planned-video',
  kind: 'generation',
  type: 'video',
  name: 'UGC planned video',
  url: null,
  prompt: 'Create the approved five-shot UGC video.',
  referenceCardIds: [assetCard.id],
  workflowTemplateId: null,
  status: 'idle',
  error: null,
    modelId: 'seedance-2',
  aspectRatio: '9:16',
  outputQuality: '1080p',
  duration: '15s',
  language: 'zh',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
};

const failedOutputCard: CanvasCard = {
  ...generationCard,
  id: 'shape:planned-video-output-1',
  kind: 'output',
  name: 'Seedance result',
  referenceCardIds: [generationCard.id],
  status: 'failed',
  error: 'Provider unavailable',
  sourceConfigCardId: generationCard.id,
  generationRunId: 'run:1',
  generationSnapshot: {
    type: generationCard.type,
    prompt: generationCard.prompt,
    referenceCardIds: [...generationCard.referenceCardIds],
    workflowTemplateId: generationCard.workflowTemplateId,
    modelId: generationCard.modelId,
    aspectRatio: generationCard.aspectRatio,
    outputQuality: generationCard.outputQuality,
    duration: generationCard.duration,
    language: generationCard.language,
    mode: generationCard.mode,
    variant: generationCard.variant,
    quality: generationCard.quality,
    capturedAt: '2026-08-16T00:00:00.000Z',
  },
};

test('keeps the version 3 project document canonical across React Flow restore', () => {
  const document = buildProjectSnapshotDocument({
    cardsById: {
      [assetCard.id]: assetCard,
      [generationCard.id]: generationCard,
      [failedOutputCard.id]: failedOutputCard,
    },
    framesById: {
      [assetCard.id]: { x: 120, y: 180, w: 360, h: 360 },
      [generationCard.id]: { x: 620, y: 180, w: 420, h: 748 },
      [failedOutputCard.id]: { x: 1136, y: 180, w: 420, h: 236 },
    },
  });

  assert.equal(document.version, 3);
  assert.deepEqual(document.frames[generationCard.id], {
    x: 620,
    y: 180,
    w: 420,
    h: 748,
  });

  const restorePlan = createProjectSnapshotRestorePlan(document);
  assert.deepEqual(restorePlan.connectors, [
    {
      sourceCardId: assetCard.id,
      targetCardId: generationCard.id,
    },
  ]);
  assert.equal(restorePlan.assetCards[0]?.card.id, assetCard.id);
  assert.equal(restorePlan.draftCards[0]?.card.id, generationCard.id);
  assert.equal(restorePlan.outputCards[0]?.card.id, failedOutputCard.id);
  assert.deepEqual(restorePlan.draftCards[0]?.frame, {
    x: 620,
    y: 180,
    w: 420,
    h: 748,
  });
});

test('undo history preserves generated outputs and their latest runtime state', () => {
  const target = buildProjectSnapshotDocument({
    cardsById: {
      [assetCard.id]: assetCard,
      [generationCard.id]: generationCard,
    },
    framesById: {
      [assetCard.id]: { x: 120, y: 180, w: 360, h: 360 },
      [generationCard.id]: { x: 620, y: 180, w: 420, h: 748 },
    },
  });
  const succeededOutput = {
    ...failedOutputCard,
    url: 'https://example.com/generated.mp4',
    status: 'succeeded' as const,
    error: null,
    sourceGenerationId: 'task:1',
  };
  const current = buildProjectSnapshotDocument({
    cardsById: {
      [assetCard.id]: assetCard,
      [generationCard.id]: generationCard,
      [succeededOutput.id]: succeededOutput,
    },
    framesById: {
      [assetCard.id]: { x: 120, y: 180, w: 360, h: 360 },
      [generationCard.id]: { x: 620, y: 180, w: 420, h: 748 },
      [succeededOutput.id]: { x: 1136, y: 180, w: 420, h: 236 },
    },
  });

  const merged = mergeCanvasRuntimeCardsIntoHistoryDocument({
    target,
    current,
  });

  assert.equal(
    merged.cards.find((card) => card.id === succeededOutput.id)?.status,
    'succeeded'
  );
  assert.equal(
    merged.frames[succeededOutput.id]?.x,
    current.frames[succeededOutput.id]?.x
  );
});
