import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard, CanvasOutputCard } from './canvas-types';
import {
  buildGenerationTakes,
  listGenerationOutputsForDraft,
  resolvePinnedGenerationOutputId,
} from './generation-history';

const makeOutput = (
  id: string,
  capturedAt: string,
  status: CanvasOutputCard['status'] = 'succeeded'
): CanvasOutputCard => ({
  id,
  kind: 'output',
  type: 'image',
  name: id,
  url: status === 'succeeded' ? `https://example.com/${id}.webp` : null,
  prompt: '',
  referenceCardIds: ['draft-1'],
  workflowTemplateId: null,
  status,
  error: null,
  modelId: 'model',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: `task:${id}`,
  sourceConfigCardId: 'draft-1',
  generationRunId: `run:${id}`,
  generationSnapshot: {
    type: 'image',
    prompt: id,
    referenceCardIds: [],
    workflowTemplateId: null,
    modelId: 'model',
    aspectRatio: '1:1',
    outputQuality: '1k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    capturedAt,
  },
});

test('lists draft outputs newest first and ignores other drafts', () => {
  const older = makeOutput('output-old', '2026-08-16T00:00:00.000Z');
  const newer = makeOutput('output-new', '2026-08-16T00:02:00.000Z');
  const other: CanvasCard = {
    ...makeOutput('output-other', '2026-08-16T00:03:00.000Z'),
    sourceConfigCardId: 'draft-2',
  };

  assert.deepEqual(
    listGenerationOutputsForDraft(
      {
        [older.id]: older,
        [newer.id]: newer,
        [other.id]: other,
      },
      'draft-1'
    ).map((card) => card.id),
    [newer.id, older.id]
  );
});

test('keeps an explicit pin and otherwise falls back to the latest success', () => {
  const failed = makeOutput(
    'output-failed',
    '2026-08-16T00:03:00.000Z',
    'failed'
  );
  const succeeded = makeOutput('output-ok', '2026-08-16T00:01:00.000Z');

  assert.equal(
    resolvePinnedGenerationOutputId({
      outputs: [failed, succeeded],
      pinnedOutputId: succeeded.id,
    }),
    succeeded.id
  );
  assert.equal(
    resolvePinnedGenerationOutputId({
      outputs: [failed, succeeded],
      pinnedOutputId: 'missing',
    }),
    succeeded.id
  );
});

test('omits failed outputs from draft history', () => {
  const failed = makeOutput(
    'output-failed',
    '2026-08-16T00:03:00.000Z',
    'failed'
  );
  const succeeded = makeOutput('output-ok', '2026-08-16T00:01:00.000Z');

  assert.deepEqual(
    listGenerationOutputsForDraft(
      {
        [failed.id]: failed,
        [succeeded.id]: succeeded,
      },
      'draft-1'
    ).map((card) => card.id),
    [succeeded.id]
  );
  assert.deepEqual(
    buildGenerationTakes({
      outputs: [failed, succeeded],
      pinnedOutputId: failed.id,
    }).map((take) => take.id),
    [succeeded.id]
  );
});

test('builds chronological takes and pins the resolved output', () => {
  const older = makeOutput('output-old', '2026-08-16T00:00:00.000Z');
  const newer = makeOutput('output-new', '2026-08-16T00:02:00.000Z');

  assert.deepEqual(
    buildGenerationTakes({
      outputs: [newer, older],
      pinnedOutputId: older.id,
    }),
    [
      {
        id: older.id,
        url: older.url,
        type: 'image',
        status: 'succeeded',
        takeNumber: 1,
        isPinned: true,
      },
      {
        id: newer.id,
        url: newer.url,
        type: 'image',
        status: 'succeeded',
        takeNumber: 2,
        isPinned: false,
      },
    ]
  );
});
