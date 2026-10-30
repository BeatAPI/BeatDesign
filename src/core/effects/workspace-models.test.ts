import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findWorkspaceModelOption,
  getCanonicalWorkspaceModelId,
  getDefaultSelectableWorkspaceModel,
  getWorkspaceAspectRatioOptions,
  getWorkspaceModelsByType,
} from './workspace-models';

test('workspace exposes the official BeatAPI image and video catalog', () => {
  const imageIds = getWorkspaceModelsByType('ai-image').map((model) => model.id);
  const videoIds = getWorkspaceModelsByType('ai-video').map((model) => model.id);

  assert.deepEqual(imageIds, [
    'nano-banana-pro',
    'nano-banana-2',
    'nano-banana-2.1',
    'nano-banana-2-lite',
    'nano-banana',
    'gpt-image-2',
    'gpt-image-2.5-flare',
    'gpt-image-2.5-sunburst',
    'seedream-5-pro',
    'seedream-5-lite',
    'qwen-image-2.1',
    'grok-imagine-image-2.0',
  ]);
  assert.deepEqual(videoIds, [
    'seedance-2',
    'seedance-2-fast',
    'seedance-2-mini',
    'seedance-2.5',
    'minimax-h3',
    'minimax-h3-fast',
    'minimax-h3-normal',
    'wan-3.0',
    'wan-3.0-prime',
    'minimax-h3-max',
    'minimax-h3-max-turbo',
    'veo-3.1',
    'kling-3',
    'kling-v4',
    'grok-imagine-video-1.5',
  ]);
  assert.equal(videoIds.includes('wan27'), false);
  assert.equal(imageIds.includes('nano-banana-2'), true);
  assert.equal(imageIds.includes('nano-banana-2-lite'), true);
});

test('legacy canvas model ids resolve to official BeatAPI slugs', () => {
  const imageModels = getWorkspaceModelsByType('ai-image');
  const videoModels = getWorkspaceModelsByType('ai-video');

  assert.equal(getCanonicalWorkspaceModelId('nanobananapro'), 'nano-banana-pro');
  assert.equal(getCanonicalWorkspaceModelId('nanobanana2'), 'nano-banana-2');
  assert.equal(
    getCanonicalWorkspaceModelId('nanobanana2lite'),
    'nano-banana-2-lite'
  );
  assert.equal(getCanonicalWorkspaceModelId('seedance20'), 'seedance-2');
  assert.equal(getCanonicalWorkspaceModelId('seedance20fast'), 'seedance-2-fast');
  assert.equal(getCanonicalWorkspaceModelId('seedance20mini'), 'seedance-2-mini');
  assert.equal(getCanonicalWorkspaceModelId('veo31'), 'veo-3.1');
  assert.equal(getCanonicalWorkspaceModelId('veo31-lite'), 'veo-3.1');
  assert.equal(getCanonicalWorkspaceModelId('kling30'), 'kling-3');
  assert.equal(
    getCanonicalWorkspaceModelId('kling26motioncontrol'),
    'kling-2.6-motion-control'
  );
  assert.equal(
    getCanonicalWorkspaceModelId('kling30motioncontrol'),
    'kling-3-motion-control'
  );
  assert.equal(
    findWorkspaceModelOption(imageModels, 'nanobananapro')?.id,
    'nano-banana-pro'
  );
  assert.equal(
    findWorkspaceModelOption(videoModels, 'seedance20')?.id,
    'seedance-2'
  );
});

test('retired Motion Control models are not selectable', () => {
  const models = getWorkspaceModelsByType('ai-video');
  assert.equal(findWorkspaceModelOption(models, 'kling-2.6-motion-control'), null);
  assert.equal(findWorkspaceModelOption(models, 'kling-3-motion-control'), null);
});

test('BeatAPI-backed models are the default image and video canvas choices', () => {
  assert.equal(
    getDefaultSelectableWorkspaceModel('ai-image')?.id,
    'nano-banana-pro'
  );
  assert.equal(
    getDefaultSelectableWorkspaceModel('ai-video')?.id,
    'seedance-2'
  );
});

test('Veo 3.1 exposes Lite, Fast, and Quality as composer modes', () => {
  const veo = findWorkspaceModelOption(
    getWorkspaceModelsByType('ai-video'),
    'veo-3.1'
  );

  assert.equal(veo?.defaultMode, 'quality');
  assert.deepEqual(veo?.modeOptions, ['quality', 'fast', 'lite']);
  assert.deepEqual(veo?.supportedOutputQualities, ['720p', '1080p', '4k']);
});

test('Composer metadata matches BeatAPI H3 and Seedance 2.5 contracts', () => {
  const videoModels = getWorkspaceModelsByType('ai-video');
  const h3 = findWorkspaceModelOption(videoModels, 'minimax-h3');
  const seedance25 = findWorkspaceModelOption(videoModels, 'seedance-2.5');

  assert.equal(h3?.defaultAspectRatio, '16:9');
  assert.equal(h3?.maxReferenceImages, 9);
  assert.equal(seedance25?.maxReferenceImages, 30);
  assert.equal(seedance25?.maxSourceVideos, 10);
  assert.equal(seedance25?.maxReferenceAudios, 10);
});

test('Grok Composer metadata matches the public BeatAPI contracts', () => {
  const image = findWorkspaceModelOption(
    getWorkspaceModelsByType('ai-image'),
    'grok-imagine-image-2.0'
  );
  const video = findWorkspaceModelOption(
    getWorkspaceModelsByType('ai-video'),
    'grok-imagine-video-1.5'
  );

  assert.equal(image?.id, 'grok-imagine-image-2.0');
  assert.equal('effectId' in image!, false);
  assert.equal(image?.maxReferenceImages, 5);
  assert.deepEqual(
    getWorkspaceAspectRatioOptions({
      model: image,
      hasImageReferences: false,
    }),
    ['1:1', '2:3', '3:2', '16:9', '9:16']
  );
  assert.deepEqual(
    getWorkspaceAspectRatioOptions({
      model: image,
      hasImageReferences: true,
    }),
    ['1:1', '2:3', '3:2', '16:9', '9:16', 'auto']
  );
  assert.equal(video?.id, 'grok-imagine-video-1.5');
  assert.equal(video?.defaultDuration, '8s');
  assert.equal(video?.supportedDurations?.length, 15);
  assert.deepEqual(video?.supportedOutputQualities, [
    '480p',
    '720p',
    '1080p',
  ]);
  assert.equal(video?.maxReferenceImages, 7);
  assert.equal(video?.maxSourceVideos, 0);
});
