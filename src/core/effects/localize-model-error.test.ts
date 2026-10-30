import assert from 'node:assert/strict';
import test from 'node:test';
import { localizeModelError } from './localize-model-error';

test('local model contract errors use translatable messages without hiding provider errors', () => {
  const t = (key: string) => key;
  assert.equal(localizeModelError('wan-3.0 images cannot be combined with video or audio references', t), 'messages.mixedModelReferences');
  assert.equal(localizeModelError('Kling 4 frame mode is not yet supported in this workspace; use reference images instead', t), 'messages.kling4Frames');
  assert.equal(localizeModelError('Unsupported wmDuration for model wan-3.0-prime: 2s', t), 'messages.unsupportedModelParameter');
  assert.equal(localizeModelError('Qwen Image 2.1 seed must not exceed 2147483647', t), 'messages.invalidQwenSeed');
  assert.equal(localizeModelError('Provider: insufficient balance', t), 'Provider: insufficient balance');
});
