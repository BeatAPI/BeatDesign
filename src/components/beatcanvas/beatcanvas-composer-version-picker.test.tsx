import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

import type { CanvasOutputCard } from '@/core/beatcanvas/canvas-types';
import type { CanvasLabels } from './beatcanvas-front-layer-context';
import { BeatCanvasComposerVersionPicker } from './beatcanvas-composer-version-picker';

const labels = {
  historyLabel: 'History',
  latestResultLabel: 'Latest result',
  readyStatusLabel: 'Ready',
  failedStatusLabel: 'Failed',
  generatingStatusLabel: 'Generating',
} as CanvasLabels;

const output: CanvasOutputCard = {
  id: 'output-1',
  kind: 'output',
  type: 'image',
  name: 'Output',
  url: 'https://example.com/one.webp',
  prompt: '',
  referenceCardIds: ['draft-1'],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: 'model',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: 'task:1',
  sourceConfigCardId: 'draft-1',
  generationRunId: 'run:1',
  generationSnapshot: {
    type: 'image',
    prompt: 'sunset',
    referenceCardIds: [],
    workflowTemplateId: null,
    modelId: 'model',
    aspectRatio: '1:1',
    outputQuality: '1k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    capturedAt: '2026-08-16T00:00:00.000Z',
  },
};

test('hides the version picker when the draft has no outputs', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerVersionPicker
      activeDraftId="draft-1"
      isDraftBusy={false}
      isOpen={false}
      labels={labels}
      onOpenChange={() => {}}
      onPinGenerationOutput={() => {}}
      outputs={[]}
      pinnedOutputId={null}
    />
  );

  assert.equal(html, '');
});

test('lists generation versions when the picker is open', () => {
  const html = renderToStaticMarkup(
    <BeatCanvasComposerVersionPicker
      activeDraftId="draft-1"
      isDraftBusy={false}
      isOpen={true}
      labels={labels}
      onOpenChange={() => {}}
      onPinGenerationOutput={() => {}}
      outputs={[output]}
      pinnedOutputId={output.id}
    />
  );

  assert.match(html, /aria-label="History"/);
  assert.match(html, /Latest result/);
  assert.match(html, /Ready/);
});
