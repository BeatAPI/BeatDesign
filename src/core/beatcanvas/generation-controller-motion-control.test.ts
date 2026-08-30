import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBeatApiTaskRequest } from '@/core/adapters/beatapi-adapter';
import { getRegisteredEffectById } from '@/core/effects/registered-effects';
import {
  findWorkspaceModelOption,
  getWorkspaceModelsByType,
} from '@/core/effects/workspace-models';
import type { CanvasCard, CanvasDraftCard } from './canvas-types';
import { buildGenerationEffectInput } from './generation-controller';

const makeCard = (overrides: Partial<CanvasCard>): CanvasCard => ({
  id: 'card',
  kind: 'asset',
  type: 'image',
  name: 'Reference',
  url: 'https://media.beatapi.io/inputs/reference.png',
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: '',
  aspectRatio: '9:16',
  outputQuality: '720p',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
  ...overrides,
}) as CanvasCard;

test('Canvas Motion Control controls reach the BeatAPI provider request', async () => {
  const model = findWorkspaceModelOption(
    getWorkspaceModelsByType('ai-video'),
    'kling-3-motion-control'
  );
  const effect = getRegisteredEffectById(20);
  assert.ok(model);
  assert.ok(effect);

  const draft = makeCard({
    id: 'draft',
    kind: 'generation',
    type: 'video',
    name: 'Kling Motion Control',
    url: null,
    prompt: 'Keep the identity and follow the motion.',
    referenceCardIds: ['character', 'motion'],
    modelId: model.id,
    outputQuality: '1080p',
    characterOrientation: 'video',
    backgroundSource: 'input_image',
    status: 'idle',
  }) as CanvasDraftCard;
  const canvasCards = {
    character: makeCard({
      id: 'character',
      type: 'image',
      url: 'https://media.beatapi.io/inputs/character.png',
    }),
    motion: makeCard({
      id: 'motion',
      type: 'video',
      url: 'https://media.beatapi.io/inputs/motion.mp4',
    }),
  };

  const built = await buildGenerationEffectInput({
    draftCard: draft,
    canvasCards,
    imageModels: [],
    videoModels: [model],
    metadataMap: { [effect.id]: effect },
    runtimeMessages: {
      missingVideoUrl: 'Missing video URL',
      readVideoDurationFailed: 'Unable to read video duration',
      videoMetadataLoadFailed: 'Unable to load video metadata',
    },
    translate: (key) => key,
    loadVideoDurationSecondsImpl: async () => 15.25,
  });

  assert.deepEqual(built.input, {
    prompt: 'Keep the identity and follow the motion.',
    wmOutputQuality: '1080p',
    image_urls: ['https://media.beatapi.io/inputs/character.png'],
    video_urls: ['https://media.beatapi.io/inputs/motion.mp4'],
    sourceVideoDurationSeconds: 15.25,
    characterOrientation: 'video',
    backgroundSource: 'input_image',
  });

  assert.deepEqual(
    buildBeatApiTaskRequest({
      effectType: effect.type,
      model: effect.model,
      input: built.input as Parameters<typeof buildBeatApiTaskRequest>[0]['input'],
    }).body,
    {
      model: 'kling-3-motion-control',
      prompt: 'Keep the identity and follow the motion.',
      images: ['https://media.beatapi.io/inputs/character.png'],
      reference_videos: ['https://media.beatapi.io/inputs/motion.mp4'],
      resolution: '1080p',
      character_orientation: 'video',
      background_source: 'input_image',
    }
  );
});
