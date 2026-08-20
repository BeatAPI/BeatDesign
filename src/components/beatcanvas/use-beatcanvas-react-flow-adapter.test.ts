import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CanvasDraftCard,
  CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';

import {
  buildGenerationCardPresentation,
  resolveDraftShapeSize,
} from './use-beatcanvas-react-flow-adapter';

const makeDraft = (
  type: CanvasDraftCard['type'],
  aspectRatio: CanvasDraftCard['aspectRatio']
): CanvasDraftCard => ({
  id: `draft-${type}-${aspectRatio}`,
  kind: 'generation',
  type,
  name: 'Draft',
  url: null,
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'idle',
  error: null,
  modelId: 'model',
  aspectRatio,
  outputQuality: type === 'image' ? '1k' : '720p',
  duration: '8s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
});

test('draft frame size follows portrait and landscape ratios', () => {
  assert.deepEqual(resolveDraftShapeSize(null, makeDraft('video', '9:16')), {
    w: 236,
    h: 420,
  });
  assert.deepEqual(resolveDraftShapeSize(null, makeDraft('video', '16:9')), {
    w: 420,
    h: 236,
  });
  assert.deepEqual(resolveDraftShapeSize(null, makeDraft('image', '9:16')), {
    w: 214,
    h: 380,
  });
  assert.deepEqual(resolveDraftShapeSize(null, makeDraft('video', '21:9')), {
    w: 420,
    h: 180,
  });
});

test('keeps the latest successful media on one generation node', () => {
  const draft = makeDraft('image', '1:1');
  const makeOutput = (
    id: string,
    status: CanvasOutputCard['status'],
    capturedAt: string,
    url: string | null
  ): CanvasOutputCard => ({
    ...draft,
    id,
    kind: 'output',
    name: id,
    url,
    status,
    error: status === 'failed' ? 'Provider unavailable' : null,
    referenceCardIds: [draft.id],
    sourceConfigCardId: draft.id,
    generationRunId: `run:${id}`,
    generationSnapshot: {
      type: draft.type,
      prompt: `${id} prompt`,
      referenceCardIds: ['asset:reference'],
      workflowTemplateId: null,
      modelId: draft.modelId,
      aspectRatio: draft.aspectRatio,
      outputQuality: draft.outputQuality,
      duration: draft.duration,
      mode: draft.mode,
      variant: draft.variant,
      quality: draft.quality,
      capturedAt,
    },
  });

  const first = makeOutput(
    'output:first',
    'succeeded',
    '2026-08-16T00:00:00.000Z',
    'https://example.com/first.webp'
  );
  const second = makeOutput(
    'output:second',
    'failed',
    '2026-08-16T00:01:00.000Z',
    null
  );
  const presentation = buildGenerationCardPresentation({
    card: draft,
    outputs: [first, second],
  });

  assert.equal(presentation.status, 'failed');
  assert.equal(presentation.latestOutputUrl, first.url);
  assert.equal(presentation.takes.length, 2);
  assert.equal(presentation.takes[0]?.id, first.id);
  assert.equal(presentation.takes[0]?.takeNumber, 1);
  assert.equal(presentation.takes[0]?.isPinned, true);
  assert.equal(presentation.takes[1]?.id, second.id);
  assert.equal('history' in presentation, false);
});
