import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findWorkspaceModelOption,
  getCanonicalWorkspaceModelId,
  getDefaultSelectableWorkspaceModel,
  getWorkspaceModelsByType,
} from './workspace-models';

test('workspace exposes the official BeatAPI image and video catalog', () => {
  const imageIds = getWorkspaceModelsByType('ai-image').map((model) => model.id);
  const videoIds = getWorkspaceModelsByType('ai-video').map((model) => model.id);

  assert.deepEqual(imageIds, [
    'nano-banana-pro',
    'nano-banana',
    'gpt-image-2',
    'seedream-5-pro',
  ]);
  assert.deepEqual(videoIds, [
    'seedance-2',
    'seedance-2.5',
    'minimax-h3',
    'veo-3.1',
    'kling-3',
    'kling-2.6-motion-control',
    'kling-3-motion-control',
  ]);
  assert.equal(videoIds.includes('wan27'), false);
  assert.equal(imageIds.includes('nanobanana2'), false);
});

test('legacy canvas model ids resolve to official BeatAPI slugs', () => {
  const imageModels = getWorkspaceModelsByType('ai-image');
  const videoModels = getWorkspaceModelsByType('ai-video');

  assert.equal(getCanonicalWorkspaceModelId('nanobananapro'), 'nano-banana-pro');
  assert.equal(getCanonicalWorkspaceModelId('seedance20'), 'seedance-2');
  assert.equal(getCanonicalWorkspaceModelId('veo31'), 'veo-3.1');
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

test('Kling Motion Control exposes one image, one motion video, and its controls', () => {
  const videoModels = getWorkspaceModelsByType('ai-video');
  const kling26 = findWorkspaceModelOption(
    videoModels,
    'kling-2.6-motion-control'
  );
  const kling3 = findWorkspaceModelOption(videoModels, 'kling-3-motion-control');

  assert.equal(kling26?.maxReferenceImages, 1);
  assert.equal(kling26?.maxSourceVideos, 1);
  assert.deepEqual(kling26?.supportedOutputQualities, ['720p', '1080p']);
  assert.deepEqual(kling26?.characterOrientationOptions, ['image', 'video']);
  assert.equal(kling3?.maxReferenceImages, 1);
  assert.equal(kling3?.maxSourceVideos, 1);
  assert.deepEqual(kling3?.backgroundSourceOptions, [
    'input_video',
    'input_image',
  ]);
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
