import assert from 'node:assert/strict';
import test from 'node:test';

import type { EffectMetadata } from '@/core/effects/client-api';
import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import type { CanvasCard, CanvasDraftCard } from './canvas-types';
import { buildGenerationEffectInput } from './generation-controller';

const languageVideoModel: WorkspaceModelOption = {
  id: 'beatdesign-language-video',
  name: 'AI Language Video',
  effectId: 15,
  uploadPath: 'effects/beatdesign-language-video',
  imageBucketName: 'image',
  defaultDuration: '15s',
  supportedDurations: ['10s', '15s'],
  defaultAspectRatio: '16:9',
  supportedAspectRatios: ['16:9', '9:16', '1:1'],
  defaultLanguage: 'zh',
  supportedLanguages: ['zh', 'en'],
};

const languageVideoMetadata: EffectMetadata = {
  id: 15,
  name: 'AI Language Video',
  inputSchema: {
    prompt: { type: 'string' },
    wmDuration: { type: 'string' },
    aspect_ratio: { type: 'string' },
    language: { type: 'string' },
  },
};

const makeDraft = (overrides: Partial<CanvasDraftCard> = {}) =>
  ({
    id: 'draft-1',
    kind: 'generation',
    type: 'video',
    name: 'Video generation',
    url: null,
    prompt: '美女在跳舞',
    referenceCardIds: [],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    modelId: 'beatdesign-language-video',
    aspectRatio: '16:9',
    outputQuality: '1080p',
    duration: '10s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    language: 'en',
    sourceGenerationId: null,
    ...overrides,
  }) as CanvasDraftCard;

test('passes video language to provider input when supported', async () => {
  const result = await buildGenerationEffectInput({
    draftCard: makeDraft(),
    canvasCards: {},
    imageModels: [],
    videoModels: [languageVideoModel],
    metadataMap: { 15: languageVideoMetadata },
    runtimeMessages: {
      missingVideoUrl: 'Missing video URL',
      readVideoDurationFailed: 'Unable to read video duration',
      videoMetadataLoadFailed: 'Unable to load video metadata',
    },
    translate: (key) => key,
  });

  assert.equal(result.input.prompt, '美女在跳舞');
  assert.equal(result.input.wmDuration, '10s');
  assert.equal(result.input.aspect_ratio, '16:9');
  assert.equal(result.input.language, 'en');
});

test('passes every connected upstream image even before model limits are configured', async () => {
  const imageModel: WorkspaceModelOption = {
    id: 'image-model',
    name: 'Image model',
    effectId: 21,
    uploadPath: 'effects/image-model',
    imageBucketName: 'image',
  };
  const imageMetadata: EffectMetadata = {
    id: 21,
    name: 'Image model',
    inputSchema: {
      prompt: { type: 'string' },
    },
  };
  const references = Object.fromEntries(
    ['one', 'two', 'three'].map((name) => [
      name,
      {
        ...makeDraft({
          id: name,
          type: 'image',
          url: `https://example.com/${name}.png`,
          status: 'succeeded',
        }),
        kind: 'asset',
      } as CanvasCard,
    ])
  );

  const result = await buildGenerationEffectInput({
    draftCard: makeDraft({
      type: 'image',
      modelId: 'image-model',
      referenceCardIds: ['one', 'two', 'three'],
    }),
    canvasCards: references,
    imageModels: [imageModel],
    videoModels: [],
    metadataMap: { 21: imageMetadata },
    runtimeMessages: {
      missingVideoUrl: 'Missing video URL',
      readVideoDurationFailed: 'Unable to read video duration',
      videoMetadataLoadFailed: 'Unable to load video metadata',
    },
    translate: (key) => key,
  });

  assert.deepEqual(result.input.image_urls, [
    'https://example.com/one.png',
    'https://example.com/two.png',
    'https://example.com/three.png',
  ]);
});

test('passes every connected reference video in @Video order', async () => {
  const videoModel: WorkspaceModelOption = {
    ...languageVideoModel,
    supportsSourceVideo: true,
    maxSourceVideos: 3,
  };
  const videoMetadata: EffectMetadata = {
    ...languageVideoMetadata,
    inputSchema: {
      prompt: { type: 'string' },
      wmDuration: { type: 'string' },
      aspect_ratio: { type: 'string' },
      language: { type: 'string' },
      video_urls: { type: 'array' },
    },
  };
  const makeVideoReference = (id: string, url: string): CanvasCard => ({
    ...makeDraft({ id, type: 'video', url, status: 'succeeded' }),
    kind: 'asset',
  });

  const result = await buildGenerationEffectInput({
    draftCard: makeDraft({
      referenceCardIds: ['motion-1', 'motion-2'],
    }),
    canvasCards: {
      'motion-1': makeVideoReference(
        'motion-1',
        'https://example.com/motion-1.mp4'
      ),
      'motion-2': makeVideoReference(
        'motion-2',
        'https://example.com/motion-2.mp4'
      ),
    },
    imageModels: [],
    videoModels: [videoModel],
    metadataMap: { 15: videoMetadata },
    runtimeMessages: {
      missingVideoUrl: 'Missing video URL',
      readVideoDurationFailed: 'Unable to read video duration',
      videoMetadataLoadFailed: 'Unable to load video metadata',
    },
    translate: (key) => key,
  });

  assert.deepEqual(result.input.video_urls, [
    'https://example.com/motion-1.mp4',
    'https://example.com/motion-2.mp4',
  ]);
});

test('blocks downstream generation until a connected upstream image is ready', async () => {
  await assert.rejects(
    buildGenerationEffectInput({
      draftCard: makeDraft({ referenceCardIds: ['upstream-image'] }),
      canvasCards: {
        'upstream-image': makeDraft({
          id: 'upstream-image',
          type: 'image',
          url: null,
        }),
      },
      imageModels: [],
      videoModels: [languageVideoModel],
      metadataMap: { 15: languageVideoMetadata },
      runtimeMessages: {
        missingVideoUrl: 'Missing video URL',
        readVideoDurationFailed: 'Unable to read video duration',
        videoMetadataLoadFailed: 'Unable to load video metadata',
      },
      translate: (key) => key,
    }),
    /messages\.imageReferencesPending/
  );
});
