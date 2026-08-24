import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard, CanvasDraftCard } from './canvas-types';
import { buildGenerationEffectInput } from './generation-controller';
import {
  VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS,
  VIDEO_ANALYSIS_EFFECT_ID,
} from '@/core/effects/video-analysis';

const makeCard = (overrides: Partial<CanvasCard>): CanvasCard => ({
  id: 'card',
  kind: 'asset',
  type: 'video',
  name: 'Source video',
  url: 'https://media.beatapi.io/inputs/source.mp4',
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: '',
  aspectRatio: '16:9',
  outputQuality: '720p',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
  ...overrides,
});

test('Canvas video analysis uses the same BeatAPI contract as Studio', async () => {
  const video = makeCard({ id: 'video-1' });
  const draft = makeCard({
    id: 'draft-1',
    kind: 'generation',
    generationMode: 'analysis',
    analysisDepth: 'deep',
    name: 'Analyze',
    url: null,
    prompt: 'Return timestamps for every action change.',
    referenceCardIds: [video.id],
    modelId: 'video-analysis',
    status: 'idle',
  }) as CanvasDraftCard;

  const built = await buildGenerationEffectInput({
    draftCard: draft,
    canvasCards: { [video.id]: video },
    imageModels: [],
    videoModels: [],
    metadataMap: {},
    runtimeMessages: {
      missingVideoUrl: 'missing',
      readVideoDurationFailed: 'duration',
      videoMetadataLoadFailed: 'metadata',
    },
    translate: (key) => key,
  });

  assert.equal(built.effectId, VIDEO_ANALYSIS_EFFECT_ID);
  assert.equal(built.model.name, 'Video Analysis Pro');
  assert.deepEqual(built.input, {
    prompt: 'Return timestamps for every action change.',
    analysis_depth: 'deep',
    max_output_tokens: VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS,
    video_url: video.url,
  });
});

test('Canvas video analysis refuses to submit without one video reference', async () => {
  const draft = makeCard({
    id: 'draft-1',
    kind: 'generation',
    generationMode: 'analysis',
    name: 'Analyze',
    url: null,
    prompt: 'Summarize the video.',
    referenceCardIds: [],
    modelId: 'video-analysis',
    status: 'idle',
  }) as CanvasDraftCard;

  await assert.rejects(
    buildGenerationEffectInput({
      draftCard: draft,
      canvasCards: {},
      imageModels: [],
      videoModels: [],
      metadataMap: {},
      runtimeMessages: {
        missingVideoUrl: 'missing',
        readVideoDurationFailed: 'duration',
        videoMetadataLoadFailed: 'metadata',
      },
      translate: (key) => key,
    }),
    /messages\.analysisVideoRequired/
  );
});

test('Canvas video analysis accepts a generated video output through @Video', async () => {
  const generatedVideo = makeCard({
    id: 'output-video-1',
    kind: 'output',
    sourceConfigCardId: 'generator-1',
    generationRunId: 'run-1',
    generationSnapshot: {
      type: 'video',
      generationMode: 'video',
      prompt: 'Generate a product reveal',
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
    url: 'https://media.beatapi.io/outputs/generated.mp4',
  });
  const draft = makeCard({
    id: 'analysis-1',
    kind: 'generation',
    generationMode: 'analysis',
    name: 'Analyze',
    url: null,
    prompt: 'Describe every shot transition.',
    referenceCardIds: [generatedVideo.id],
    modelId: 'video-analysis',
    status: 'idle',
  }) as CanvasDraftCard;

  const built = await buildGenerationEffectInput({
    draftCard: draft,
    canvasCards: { [generatedVideo.id]: generatedVideo },
    imageModels: [],
    videoModels: [],
    metadataMap: {},
    runtimeMessages: {
      missingVideoUrl: 'missing',
      readVideoDurationFailed: 'duration',
      videoMetadataLoadFailed: 'metadata',
    },
    translate: (key) => key,
  });

  assert.equal(
    built.input.video_url,
    'https://media.beatapi.io/outputs/generated.mp4'
  );
});
