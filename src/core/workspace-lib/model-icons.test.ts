import assert from 'node:assert/strict';
import test from 'node:test';

import { getModelIconPathByModelId } from './model-icons';

test('all Kling models reuse the verified Kling SVG', () => {
  for (const modelId of [
    'kling-3',
    'kling-2.6-motion-control',
    'kling-3-motion-control',
  ]) {
    assert.equal(
      getModelIconPathByModelId(modelId),
      '/model-icons/kling-color.svg'
    );
  }
});

test('Grok Imagine image and video models reuse the Grok SVG', () => {
  for (const modelId of [
    'grok-imagine-image-2.0',
    'grok-imagine-video-1.5',
  ]) {
    assert.equal(getModelIconPathByModelId(modelId), '/model-icons/grok.svg');
  }
});
