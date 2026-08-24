import assert from 'node:assert/strict';
import test from 'node:test';

import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type { CanvasCard, CanvasGenerationCard } from './canvas-types';
import {
  canUseCanvasCardAsGenerationReference,
  getDraftReferencePickerOptions,
  listCompatibleCanvasReferenceCards,
  removeReferenceCardId,
  resolveReferenceDrivenDraftAspectRatio,
  resolveWorkspaceAspectRatioFromDimensions,
  shouldIgnoreCanvasModifierShortcut,
} from './composer';
import { resolveReferencePayload } from './canvas-workflows';

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

test('Composer stops offering @Image references at the model limit', () => {
  const first = makeCard({ id: 'image-1' });
  const last = makeCard({ id: 'image-2' });
  assert.deepEqual(
    getDraftReferencePickerOptions({
      draftCard: {
        ...makeDraft(),
        referenceCardIds: [first.id, last.id],
      },
      cards: { [first.id]: first, [last.id]: last },
      model: makeModel({ maxReferenceImages: 2 }),
    }),
    []
  );
});

test('Motion Control stops offering references after one image and one video', () => {
  const draft = {
    ...makeDraft(),
    modelId: 'kling-3-motion-control',
    referenceCardIds: ['image-1', 'video-1'],
  };
  const cards = {
    'image-1': makeCard({ id: 'image-1', type: 'image' }),
    'video-1': makeCard({
      id: 'video-1',
      type: 'video',
      url: 'https://example.com/motion.mp4',
    }),
  };

  assert.deepEqual(
    getDraftReferencePickerOptions({
      draftCard: draft,
      cards,
      model: makeModel({
        id: 'kling-3-motion-control',
        maxReferenceImages: 1,
        maxSourceVideos: 1,
        supportsSourceVideo: true,
      }),
    }),
    []
  );
});

test('video analysis accepts exactly one video reference and no images', () => {
  const video = makeCard({
    id: 'video-1',
    type: 'video',
    url: 'https://example.com/source.mp4',
  });
  const image = makeCard({ id: 'image-1', type: 'image' });
  const draft = {
    ...makeDraft(),
    type: 'video' as const,
    generationMode: 'analysis' as const,
    modelId: 'video-analysis',
  };

  assert.deepEqual(
    getDraftReferencePickerOptions({
      draftCard: draft,
      cards: { [video.id]: video, [image.id]: image },
      model: null,
    }),
    [{ intent: 'video', remaining: 1 }]
  );
  assert.deepEqual(
    listCompatibleCanvasReferenceCards({
      draftCard: draft,
      cards: { [video.id]: video, [image.id]: image },
      model: null,
    }).map((card) => card.id),
    [video.id]
  );
  assert.deepEqual(
    getDraftReferencePickerOptions({
      draftCard: { ...draft, referenceCardIds: [video.id] },
      cards: { [video.id]: video },
      model: null,
    }),
    []
  );
});

test('video analysis can select a generated output as @Video', () => {
  const output = makeCard({
    id: 'output-video',
    kind: 'output',
    type: 'video',
    url: 'https://media.beatapi.io/outputs/generated.mp4',
    sourceConfigCardId: 'generator',
    generationRunId: 'run-1',
    generationSnapshot: {
      type: 'video',
      generationMode: 'video',
      prompt: 'Generate',
      referenceCardIds: [],
      workflowTemplateId: null,
      modelId: 'seedance-2',
      aspectRatio: '16:9',
      outputQuality: '720p',
      duration: '5s',
      mode: 'quality',
      variant: 'standard',
      quality: 'standard',
      capturedAt: '2026-08-24T00:00:00.000Z',
    },
  });
  const draft = {
    ...makeDraft(),
    type: 'video' as const,
    generationMode: 'analysis' as const,
    modelId: 'video-analysis',
  };

  assert.deepEqual(
    listCompatibleCanvasReferenceCards({
      draftCard: draft,
      cards: { [output.id]: output },
      model: null,
    }).map((card) => card.id),
    [output.id]
  );
});

test('maps real media dimensions to the nearest supported canvas ratio', () => {
  assert.equal(
    resolveWorkspaceAspectRatioFromDimensions({
      width: 1080,
      height: 1920,
      fallback: '16:9',
    }),
    '9:16'
  );
  assert.equal(
    resolveWorkspaceAspectRatioFromDimensions({
      width: 1080,
      height: 1440,
      fallback: '16:9',
    }),
    '3:4'
  );
  assert.equal(
    resolveWorkspaceAspectRatioFromDimensions({
      width: 0,
      height: 0,
      fallback: '16:9',
    }),
    '16:9'
  );
});

test('Motion Control follows the selected reference ratio and falls back to 16:9', () => {
  const model = makeModel({
    id: 'kling-3-motion-control',
    characterOrientationOptions: ['image', 'video'],
    defaultCharacterOrientation: 'video',
  });
  const image = makeCard({
    id: 'image-1',
    type: 'image',
    aspectRatio: '3:4',
  });
  const video = makeCard({
    id: 'video-1',
    type: 'video',
    aspectRatio: '16:9',
  });
  const draft = {
    ...makeDraft(),
    modelId: model.id,
    type: 'video' as const,
    aspectRatio: '16:9' as const,
    referenceCardIds: [image.id, video.id],
    characterOrientation: 'video' as const,
  };
  const cards = { [image.id]: image, [video.id]: video };

  assert.equal(
    resolveReferenceDrivenDraftAspectRatio({
      draftCard: draft,
      cards,
      model,
      getReferenceDimensions: (card) =>
        card.id === video.id ? { width: 203, height: 360 } : null,
    }),
    '9:16'
  );
  assert.equal(
    resolveReferenceDrivenDraftAspectRatio({
      draftCard: { ...draft, characterOrientation: 'image' },
      cards,
      model,
    }),
    '3:4'
  );
  assert.equal(
    resolveReferenceDrivenDraftAspectRatio({
      draftCard: { ...draft, referenceCardIds: [] },
      cards,
      model,
    }),
    '16:9'
  );
});

test('models with an explicit ratio selector keep the user selection', () => {
  const model = makeModel({
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    characterOrientationOptions: ['image', 'video'],
  });
  const image = makeCard({ aspectRatio: '9:16' });
  const draft = {
    ...makeDraft(),
    aspectRatio: '1:1' as const,
    referenceCardIds: [image.id],
    characterOrientation: 'image' as const,
  };

  assert.equal(
    resolveReferenceDrivenDraftAspectRatio({
      draftCard: draft,
      cards: { [image.id]: image },
      model,
    }),
    '1:1'
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
      model: makeModel({ maxReferenceImages: 2 }),
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

test('preserves every compatible reference video in attachment order', () => {
  assert.deepEqual(
    resolveReferencePayload({
      taskType: 'video',
      cards: [
        {
          id: 'video-1',
          name: 'Motion one',
          type: 'video',
          url: 'https://example.com/one.mp4',
          role: 'asset',
        },
        {
          id: 'image-1',
          name: 'Character',
          type: 'image',
          url: 'https://example.com/person.png',
          role: 'asset',
        },
        {
          id: 'video-2',
          name: 'Motion two',
          type: 'video',
          url: 'https://example.com/two.mp4',
          role: 'asset',
        },
      ],
    }),
    {
      imageUrls: ['https://example.com/person.png'],
      videoUrls: [
        'https://example.com/one.mp4',
        'https://example.com/two.mp4',
      ],
    }
  );
});
