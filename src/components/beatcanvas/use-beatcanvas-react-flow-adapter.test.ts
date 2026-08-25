import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type {
  CanvasDraftCard,
  CanvasOutputCard,
} from '@/core/beatcanvas/canvas-types';

import {
  buildAnalysisReportNodeProps,
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

  assert.equal(presentation.status, 'succeeded');
  assert.equal(presentation.latestOutputUrl, first.url);
  assert.equal(presentation.takes.length, 1);
  assert.equal(presentation.takes[0]?.id, first.id);
  assert.equal(presentation.takes[0]?.takeNumber, 1);
  assert.equal(presentation.takes[0]?.isPinned, true);
  assert.equal('history' in presentation, false);
});

test('moves successful video analysis text into a separate report node', () => {
  const draft = {
    ...makeDraft('video', '16:9'),
    generationMode: 'analysis' as const,
    analysisDepth: 'deep' as const,
    modelId: 'video-analysis',
  };
  const output: CanvasOutputCard = {
    ...draft,
    id: 'output:analysis',
    kind: 'output',
    name: 'Video Analysis Pro result',
    resultText: '00:00-00:03 The subject walks into frame.',
    status: 'succeeded',
    referenceCardIds: [draft.id],
    sourceConfigCardId: draft.id,
    generationRunId: 'run:analysis',
    generationSnapshot: {
      type: 'video',
      generationMode: 'analysis',
      analysisDepth: 'deep',
      prompt: 'Return timestamps.',
      referenceCardIds: ['asset:video'],
      workflowTemplateId: null,
      modelId: 'video-analysis',
      aspectRatio: '16:9',
      outputQuality: '720p',
      duration: '5s',
      mode: 'quality',
      variant: 'standard',
      quality: 'standard',
      resultText: null,
      capturedAt: '2026-08-24T00:00:00.000Z',
    },
  };

  const presentation = buildGenerationCardPresentation({
    card: draft,
    outputs: [output],
  });

  assert.equal(presentation.isAnalysis, true);
  assert.equal(presentation.latestOutputUrl, null);
  assert.equal(presentation.latestOutputText, null);
  assert.equal(presentation.analysisReportCount, 1);

  const reportProps = buildAnalysisReportNodeProps(output, 'Analysis report');
  assert.deepEqual(reportProps, {
    w: 480,
    h: 340,
    cardMediaType: 'video',
    label: 'Analysis report',
    status: 'succeeded',
    isAnalysis: true,
    latestOutputUrl: null,
    latestOutputText: output.resultText,
    analysisReportCount: 0,
    takes: [],
  });
});

test('does not materialize pending or media outputs as analysis reports', () => {
  const draft = {
    ...makeDraft('video', '16:9'),
    generationMode: 'analysis' as const,
    modelId: 'video-analysis',
  };
  const pendingOutput: CanvasOutputCard = {
    ...draft,
    id: 'output:pending-analysis',
    kind: 'output',
    name: 'Pending analysis',
    resultText: null,
    status: 'processing',
    referenceCardIds: [draft.id],
    sourceConfigCardId: draft.id,
    generationRunId: 'run:pending-analysis',
    generationSnapshot: {
      type: 'video',
      generationMode: 'analysis',
      prompt: 'Analyze this video.',
      referenceCardIds: ['asset:video'],
      workflowTemplateId: null,
      modelId: 'video-analysis',
      aspectRatio: '16:9',
      outputQuality: '720p',
      duration: '5s',
      mode: 'quality',
      variant: 'standard',
      quality: 'standard',
      capturedAt: '2026-08-25T00:00:00.000Z',
    },
  };

  assert.equal(
    buildAnalysisReportNodeProps(pendingOutput, 'Analysis report'),
    null
  );
});

test('materializes and connects a completed analysis report after its source node', () => {
  const source = readFileSync(
    new URL('./use-beatcanvas-react-flow-adapter.ts', import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /createConnectorBetweenCards\(draftCard\.id, outputCard\.id\)/
  );
  assert.match(source, /resultText: isAnalysisOutput \? null : resultText/);
  assert.match(source, /studioT\('canvas\.shapes\.analysisReport'\)/);
});
