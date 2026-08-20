import assert from 'node:assert/strict';
import test from 'node:test';

import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type { CanvasCard, CanvasGenerationCard } from './canvas-types';
import {
  canUseCanvasCardAsGenerationReference,
  getDraftReferencePickerOptions,
  listCompatibleCanvasReferenceCards,
  removeReferenceCardId,
  shouldIgnoreCanvasModifierShortcut,
} from './composer';

const makeModel = (
  overrides: Partial<WorkspaceModelOption> = {}
): WorkspaceModelOption => ({
  id: 'model-1',
  name: 'Model',
  effectId: 1,
  uploadPath: 'effects/model',
  imageBucketName: 'image',
  maxReferenceImages: 0,
  maxSourceVideos: 0,
  ...overrides,
});

const makeCard = (
  overrides: Partial<CanvasCard> = {}
): CanvasCard => ({
  id: 'card-1',
  kind: 'asset',
  type: 'image',
  name: 'Card',
  url: 'https://example.com/card.png',
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

const makeDraft = (): CanvasGenerationCard => ({
  ...makeCard({
    id: 'draft-1',
    kind: 'generation',
    url: null,
    status: 'idle',
    modelId: 'model-1',
  }),
  kind: 'generation',
});

test('keeps image references available before model-specific limits are configured', () => {
  assert.deepEqual(
    getDraftReferencePickerOptions({
      draftCard: makeDraft(),
      cards: {},
      model: makeModel(),
    }),
    [{ intent: 'image', remaining: null }]
  );
});

test('allows upstream images for image and video generation', () => {
  const sourceCard = makeCard();

  assert.equal(
    canUseCanvasCardAsGenerationReference({
      sourceCard,
      targetType: 'image',
      targetModel: makeModel(),
    }),
    true
  );
  assert.equal(
    canUseCanvasCardAsGenerationReference({
      sourceCard,
      targetType: 'video',
      targetModel: makeModel(),
    }),
    true
  );
});

test('only allows upstream videos for confirmed video-input models', () => {
  const sourceCard = makeCard({
    type: 'video',
    url: 'https://example.com/card.mp4',
  });

  assert.equal(
    canUseCanvasCardAsGenerationReference({
      sourceCard,
      targetType: 'video',
      targetModel: makeModel(),
    }),
    false
  );
  assert.equal(
    canUseCanvasCardAsGenerationReference({
      sourceCard,
      targetType: 'video',
      targetModel: makeModel({ supportsSourceVideo: true }),
    }),
    true
  );
});

test('lists unused canvas cards that can be attached as references', () => {
  const draft = makeDraft();
  const attached = makeCard({ id: 'asset-attached' });
  const available = makeCard({ id: 'asset-available' });
  const noUrl = makeCard({ id: 'asset-empty', url: null });

  assert.deepEqual(
    listCompatibleCanvasReferenceCards({
      draftCard: { ...draft, referenceCardIds: [attached.id] },
      cards: {
        [draft.id]: draft,
        [attached.id]: attached,
        [available.id]: available,
        [noUrl.id]: noUrl,
      },
      model: makeModel(),
    }).map((card) => card.id),
    [available.id]
  );
});

test('removes a reference id without disturbing the rest', () => {
  assert.deepEqual(removeReferenceCardId(['a', 'b', 'c'], 'b'), ['a', 'c']);
});

test('modifier shortcuts still work outside text fields', () => {
  assert.equal(shouldIgnoreCanvasModifierShortcut({ tagName: 'DIV' }), false);
  assert.equal(shouldIgnoreCanvasModifierShortcut({ tagName: 'INPUT' }), true);
  assert.equal(
    shouldIgnoreCanvasModifierShortcut({ isContentEditable: true }),
    true
  );
});
