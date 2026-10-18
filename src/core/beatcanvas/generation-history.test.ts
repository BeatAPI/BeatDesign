import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard, CanvasOutputCard } from './canvas-types';
import {
  buildGenerationTakes,
  listGenerationOutputsForDraft,
  resolveConcreteCanvasMediaCard,
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

for (const type of ['image', 'video'] as const) {
  test(`${type} defaults to the newest usable take regardless of input order`, () => {
    const older = { ...makeOutput('old', '2026-10-18T00:00:00.000Z'), type };
    const newer = { ...makeOutput('new', '2026-10-18T00:01:00.000Z'), type };
    const pending = { ...makeOutput('pending', '2026-10-18T00:02:00.000Z', 'processing'), type };
    const empty = { ...makeOutput('empty', '2026-10-18T00:03:00.000Z'), type, url: null };
    const failed = { ...makeOutput('failed', '2026-10-18T00:04:00.000Z', 'failed'), type };
    for (const outputs of [[older, pending, newer, empty, failed], [failed, empty, newer, pending, older]]) {
      const originalOrder = outputs.map((output) => output.id);
      for (const pinnedOutputId of [null, 'missing', failed.id, empty.id, pending.id]) {
        assert.equal(resolvePinnedGenerationOutputId({ outputs, pinnedOutputId }), newer.id);
        const takes = buildGenerationTakes({ outputs, pinnedOutputId });
        assert.equal(takes.find((take) => take.isPinned)?.id, newer.id);
        assert.equal(takes.find((take) => take.id === newer.id)?.takeNumber, 2);
      }
      assert.equal(resolvePinnedGenerationOutputId({ outputs, pinnedOutputId: older.id }), older.id);
      assert.deepEqual(outputs.map((output) => output.id), originalOrder);
    }
    const draft = { ...older, id: 'draft-1', kind: 'generation' as const, pinnedOutputId: null };
    const cards = Object.fromEntries([draft, older, newer, pending, failed].map((card) => [card.id, card]));
    assert.equal(resolveConcreteCanvasMediaCard({ cards, card: draft })?.id, newer.id);
  });
}

test('fallback handles empty histories, only failed outputs and equal timestamps deterministically', () => {
  const time = '2026-10-18T00:00:00.000Z';
  assert.equal(resolvePinnedGenerationOutputId({ outputs: [] }), null);
  assert.equal(resolvePinnedGenerationOutputId({ outputs: [makeOutput('failed', time, 'failed')] }), null);
  for (const status of ['succeeded', 'pending'] as const) {
    const a = makeOutput('a', time, status);
    const b = makeOutput('b', time, status);
    assert.equal(resolvePinnedGenerationOutputId({ outputs: [a, b] }), 'b');
    assert.equal(resolvePinnedGenerationOutputId({ outputs: [b, a] }), 'b');
  }
});

test('resolves a generation node to its pinned concrete output asset', () => {
  const older = makeOutput('output-old', '2026-08-16T00:00:00.000Z');
  const newer = makeOutput('output-new', '2026-08-16T00:02:00.000Z');
  const draft: CanvasCard = {
    id: 'draft-1',
    kind: 'generation',
    type: 'image',
    name: 'Image generation',
    url: newer.url,
    prompt: 'A product shot',
    referenceCardIds: [],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    modelId: 'model',
    aspectRatio: '1:1',
    outputQuality: '1k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    sourceGenerationId: null,
    pinnedOutputId: older.id,
  };
  const cards = {
    [draft.id]: draft,
    [older.id]: older,
    [newer.id]: newer,
  };
  assert.equal(
    resolveConcreteCanvasMediaCard({ cards, card: draft })?.id,
    older.id
  );
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
