import assert from 'node:assert/strict';
import test from 'node:test';

import { getEffectById, getEffectsByIds } from './effects';
import { getRegisteredEffectById } from './registered-effects';
import { VIDEO_ANALYSIS_EFFECT_ID } from './video-analysis';

test('official BeatAPI models resolve from the code registry', async () => {
  const nanoBananaPro = await getEffectById(6);
  const seedance = await getEffectById(9);
  const missing = await getEffectById(15);

  assert.equal(nanoBananaPro?.model, 'nano-banana-pro');
  assert.equal(nanoBananaPro?.provider, 'beatapi');
  assert.equal(nanoBananaPro?.type, 2);
  assert.equal(seedance?.model, 'seedance-2');
  assert.equal(seedance?.type, 1);
  assert.equal(missing, null);
});

test('video analysis is a separate registered workflow with two depths', () => {
  const analysis = getRegisteredEffectById(VIDEO_ANALYSIS_EFFECT_ID);
  const schema = analysis?.inputSchema as Record<string, unknown>;

  assert.equal(analysis?.model, 'video-analysis');
  assert.equal(analysis?.type, 3);
  assert.equal(analysis?.api, 'https://api.beatapi.io/v1/video-analysis/tasks');
  assert.deepEqual(
    (schema.analysis_depth as { values?: string[] }).values,
    ['standard', 'deep']
  );
  assert.ok(schema.video_url);
});

test('registry effects include the input fields the canvas already sends', () => {
  const seedance = getRegisteredEffectById(9);
  const schema = seedance?.inputSchema as Record<string, unknown>;

  assert.ok(schema.prompt);
  assert.ok(schema.aspect_ratio);
  assert.ok(schema.wmDuration);
  assert.ok(schema.wmOutputQuality);
  assert.ok(schema.image_urls);
  assert.ok(schema.video_urls);
  assert.ok(schema.audio_urls);
});

test('batch lookup only returns official registry models', async () => {
  const effects = await getEffectsByIds([6, 15, 17, 6]);
  assert.deepEqual(
    effects.map((effect) => effect.model).sort(),
    ['minimax-h3', 'nano-banana-pro']
  );
});

test('Veo 3.1 registry schema exposes quality mode and resolution', () => {
  const veo = getRegisteredEffectById(1)?.inputSchema as Record<string, unknown>;
  const mode = veo.mode as { values?: string[] };
  const quality = veo.wmOutputQuality as { values?: string[] };

  assert.deepEqual(mode.values, ['quality', 'fast', 'lite']);
  assert.deepEqual(quality.values, ['720p', '1080p', '4k']);
});

test('Seedance 2 Fast and Mini resolve from the code registry', () => {
  assert.equal(getRegisteredEffectById(21)?.model, 'seedance-2-fast');
  assert.equal(getRegisteredEffectById(22)?.model, 'seedance-2-mini');
});

test('Motion Control registry schemas expose provider controls', () => {
  const kling26 = getRegisteredEffectById(19)?.inputSchema as Record<
    string,
    unknown
  >;
  const kling3 = getRegisteredEffectById(20)?.inputSchema as Record<
    string,
    unknown
  >;

  assert.ok(kling26.image_urls);
  assert.ok(kling26.video_urls);
  assert.ok(kling26.wmOutputQuality);
  assert.ok(kling26.sourceVideoDurationSeconds);
  assert.ok(kling26.characterOrientation);
  assert.ok(kling3.backgroundSource);
});
