import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { removeCanvasCardsForShapeIds } from './use-beatcanvas-state';

const generationCard: CanvasCard = {
  id: 'shape:generation',
  kind: 'generation',
  type: 'image',
  name: 'Image generation',
  url: 'https://example.com/latest.webp',
  prompt: 'A cinematic portrait',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'idle',
  error: null,
  modelId: 'nano-banana-pro',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
};

const outputCard: CanvasCard = {
  ...generationCard,
  id: 'output:1',
  kind: 'output',
  name: 'Generated result',
  referenceCardIds: [generationCard.id],
  sourceConfigCardId: generationCard.id,
  generationRunId: 'run:1',
  generationSnapshot: {
    type: generationCard.type,
    prompt: generationCard.prompt,
    referenceCardIds: [],
    workflowTemplateId: null,
    modelId: generationCard.modelId,
    aspectRatio: generationCard.aspectRatio,
    outputQuality: generationCard.outputQuality,
    duration: generationCard.duration,
    mode: generationCard.mode,
    variant: generationCard.variant,
    quality: generationCard.quality,
    capturedAt: '2026-08-16T00:00:00.000Z',
  },
};

test('does not treat a transient empty renderer snapshot as card deletion', () => {
  const reconciled = removeCanvasCardsForShapeIds(
    {
      [generationCard.id]: generationCard,
      [outputCard.id]: outputCard,
    },
    new Set()
  );

  assert.deepEqual(Object.keys(reconciled).sort(), [
    outputCard.id,
    generationCard.id,
  ]);
});

test('removes a deleted visual card and its hidden generation history explicitly', () => {
  const reconciled = removeCanvasCardsForShapeIds(
    {
      [generationCard.id]: generationCard,
      [outputCard.id]: outputCard,
    },
    new Set([generationCard.id])
  );

  assert.deepEqual(reconciled, {});
});
