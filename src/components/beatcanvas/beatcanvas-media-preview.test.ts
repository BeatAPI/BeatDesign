import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard } from '@/core/beatcanvas/canvas-types';

import {
  getPreviewableCanvasCardFromSelection,
  isPreviewableCanvasCard,
  resolveBatchCanvasCardSelection,
} from './beatcanvas-media-preview';

const makeCard = (overrides: Partial<CanvasCard>): CanvasCard => ({
  id: 'shape:asset',
  kind: 'asset',
  type: 'image',
  name: 'Product image',
  url: 'blob:local-product-preview',
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
  ...overrides,
});

test('recognizes only real image asset cards as previewable', () => {
  assert.equal(isPreviewableCanvasCard(makeCard({})), true);
  assert.equal(
    isPreviewableCanvasCard(
      makeCard({ url: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E' })
    ),
    false
  );
  assert.equal(isPreviewableCanvasCard(makeCard({ type: 'video' })), false);
  assert.equal(
    isPreviewableCanvasCard(makeCard({ kind: 'generation' })),
    false
  );
});

test('resolves a single previewable card from a group that also contains svg placeholders', () => {
  const shellCard = makeCard({
    id: 'shape:reference-shell',
    name: '参考图片',
    url: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E',
  });
  const referenceCard = makeCard({
    id: 'shape:reference-1',
  });

  assert.equal(
    getPreviewableCanvasCardFromSelection({
      selectedSingleCard: null,
      selectedGroupCards: [shellCard, referenceCard],
    }),
    referenceCard
  );
});

test('does not guess which group image to preview when multiple real images are selected', () => {
  assert.equal(
    getPreviewableCanvasCardFromSelection({
      selectedSingleCard: null,
      selectedGroupCards: [
        makeCard({ id: 'shape:reference-1' }),
        makeCard({ id: 'shape:reference-2' }),
      ],
    }),
    null
  );
});

test('uses ordinary multi-selected canvas cards for batch actions', () => {
  const first = makeCard({ id: 'shape:first' });
  const second = makeCard({ id: 'shape:second' });

  assert.deepEqual(
    resolveBatchCanvasCardSelection({
      cardsById: { [first.id]: first, [second.id]: second },
      selectedCanvasCardIds: [first.id, second.id],
      selectedGroupCards: [],
    }).map((card) => card.id),
    [first.id, second.id]
  );
  assert.deepEqual(
    resolveBatchCanvasCardSelection({
      cardsById: { [first.id]: first },
      selectedCanvasCardIds: [first.id],
      selectedGroupCards: [],
    }),
    []
  );
});
