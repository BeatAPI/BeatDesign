import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildBeatApiTaskRequest } from '@/core/adapters/beatapi-adapter';
import { getRegisteredEffectById } from '@/core/effects/registered-effects';
import {
  getWorkspaceMediaSchema,
} from '@/core/effects/workspace-media';
import { getWorkspaceModelsByType } from '@/core/effects/workspace-models';
import { getModelIconPathByModelId } from '@/core/workspace-lib/model-icons';

const syncedModels = [
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
  'wan-3.0',
  'wan-3.0-prime',
  'happyhorse-1.0',
  'happyhorse-1.1',
  'minimax-h3-max',
  'minimax-h3-max-turbo',
] as const;

test('the BeatDesign catalog exposes every newly synced BeatAPI model', () => {
  const catalogIds = new Set([
    ...getWorkspaceModelsByType('ai-image'),
    ...getWorkspaceModelsByType('ai-video'),
  ].map((model) => model.id));

  for (const modelId of syncedModels) assert.ok(catalogIds.has(modelId), modelId);
});

test('GPT Image 2.5 maps its 16-image and 4K contract', () => {
  for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
    assert.equal(getWorkspaceMediaSchema(model)?.image.max, 16);
    const request = buildBeatApiTaskRequest({
      effectType: 2,
      model,
      input: {
        prompt: 'Campaign image',
        aspect_ratio: '21:9',
        wmOutputQuality: '4k',
      },
    });
    assert.deepEqual(request, {
      path: '/v1/images/tasks',
      body: {
        model,
        prompt: 'Campaign image',
        aspect_ratio: '21:9',
        resolution: '4K',
      },
    });
  }
});

test('Wan 3.0 keeps image, video, and audio reference field names', () => {
  const request = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'wan-3.0-prime',
    input: {
      prompt: 'Match the reference motion',
      image_urls: ['https://media.beatapi.io/input.png'],
      video_urls: ['https://media.beatapi.io/reference.mp4'],
      audio_urls: ['https://media.beatapi.io/reference.mp3'],
      wmDuration: '30s',
      aspect_ratio: '9:16',
      wmOutputQuality: '1080p',
    },
  });

  assert.deepEqual(request.body, {
    model: 'wan-3.0-prime',
    prompt: 'Match the reference motion',
    images: ['https://media.beatapi.io/input.png'],
    reference_videos: ['https://media.beatapi.io/reference.mp4'],
    reference_audios: ['https://media.beatapi.io/reference.mp3'],
    aspect_ratio: '9:16',
    duration: 30,
    resolution: '1080p',
  });
});

test('HappyHorse requires image input and publishes that requirement to agents', () => {
  assert.throws(
    () => buildBeatApiTaskRequest({
      effectType: 1,
      model: 'happyhorse-1.1',
      input: { prompt: 'Animate the subject' },
    }),
    /requires at least one image/
  );
  const inputSchema = getRegisteredEffectById(32)?.inputSchema as Record<
    string,
    { required?: boolean }
  >;
  assert.equal(inputSchema.image_urls?.required, true);

  const request = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'happyhorse-1.1',
    input: {
      prompt: 'Animate the subject',
      image_urls: ['https://media.beatapi.io/subject.png'],
      wmDuration: '15s',
      aspect_ratio: '3:4',
      wmOutputQuality: '1080p',
    },
  });
  assert.deepEqual(request.body, {
    model: 'happyhorse-1.1',
    prompt: 'Animate the subject',
    images: ['https://media.beatapi.io/subject.png'],
    aspect_ratio: '3:4',
    duration: 15,
    resolution: '1080p',
  });
});

test('MiniMax H3 Max preserves ordered frames, upper-case resolution, and seed', () => {
  const request = buildBeatApiTaskRequest({
    effectType: 1,
    model: 'minimax-h3-max-turbo',
    input: {
      prompt: 'Move from first frame to last frame',
      image_urls: [
        'https://media.beatapi.io/first.png',
        'https://media.beatapi.io/last.png',
      ],
      wmDuration: '5s',
      wmOutputQuality: '480p',
      aspect_ratio: '16:9',
      seed: 42,
    },
  });

  assert.deepEqual(request.body, {
    model: 'minimax-h3-max-turbo',
    prompt: 'Move from first frame to last frame',
    images: [
      'https://media.beatapi.io/first.png',
      'https://media.beatapi.io/last.png',
    ],
    duration: 5,
    resolution: '480P',
    seed: 42,
  });
});

test('new models resolve to local SVG icons with visible vector content', () => {
  const expectedIcons = new Map([
    ['gpt-image-2.5-flare', '/model-icons/openai.svg'],
    ['gpt-image-2.5-sunburst', '/model-icons/openai.svg'],
    ['wan-3.0', '/model-icons/qwen-color.svg'],
    ['wan-3.0-prime', '/model-icons/qwen-color.svg'],
    ['happyhorse-1.0', '/model-icons/happyhorse.svg'],
    ['happyhorse-1.1', '/model-icons/happyhorse.svg'],
    ['minimax-h3-max', '/model-icons/minimax-color.svg'],
    ['minimax-h3-max-turbo', '/model-icons/minimax-color.svg'],
  ]);

  for (const [modelId, iconPath] of expectedIcons) {
    assert.equal(getModelIconPathByModelId(modelId), iconPath);
    const source = readFileSync(
      new URL(`../../../public${iconPath}`, import.meta.url),
      'utf8'
    );
    assert.match(source, /^<svg\b/);
    assert.match(source, /<(?:path|rect)\b/);
  }
});

test('new model reference limits fail before an upstream request is submitted', () => {
  assert.throws(
    () => buildBeatApiTaskRequest({
      effectType: 2,
      model: 'gpt-image-2.5-flare',
      input: {
        prompt: 'Too many references',
        image_urls: Array.from(
          { length: 17 },
          (_, index) => `https://media.beatapi.io/image-${index}.png`
        ),
      },
    }),
    /at most 16 references/
  );
  assert.throws(
    () => buildBeatApiTaskRequest({
      effectType: 1,
      model: 'wan-3.0',
      input: {
        prompt: 'Too many videos',
        video_urls: Array.from(
          { length: 6 },
          (_, index) => `https://media.beatapi.io/video-${index}.mp4`
        ),
      },
    }),
    /at most 5 references/
  );
  assert.throws(
    () => buildBeatApiTaskRequest({
      effectType: 1,
      model: 'minimax-h3-max',
      input: {
        prompt: 'Too many frames',
        image_urls: Array.from(
          { length: 3 },
          (_, index) => `https://media.beatapi.io/frame-${index}.png`
        ),
      },
    }),
    /at most 2 references/
  );
});
