import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getActiveGenerationProvider,
  getGenerationProvider,
  getGenerationModelBinding,
  getGenerationModelDescriptor,
  listGenerationModelDescriptors,
} from './index';

test('BeatAPI remains the test default behind stable logical model ids', () => {
  const provider = getActiveGenerationProvider();
  const binding = getGenerationModelBinding({ modelId: 'seedance-2' });

  assert.equal(provider.id, 'beatapi');
  assert.equal(binding?.effectId, 9);
  assert.equal(binding?.upstreamModelId, 'seedance-2');
});

test('the fork registers the restricted 16688 AI image provider', () => {
  const provider = getGenerationProvider('16688');
  assert.equal(provider?.label, '16688 AI');
  assert.deepEqual(provider?.supports, ['image']);
  assert.deepEqual(
    provider?.modelBindings.map((binding) => binding.modelId),
    ['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']
  );
});

test('model discovery exposes parameters and references without upstream URLs', () => {
  const models = listGenerationModelDescriptors();
  const seedance = getGenerationModelDescriptor('seedance-2');

  assert.ok(models.length >= 10);
  assert.equal(seedance?.providerId, 'beatapi');
  assert.equal(seedance?.kind, 'video');
  assert.ok(seedance?.parameterSchema);
  assert.ok(seedance?.referenceSchema);
  assert.equal('effectId' in (seedance ?? {}), false);
  assert.equal('api' in (seedance ?? {}), false);
});

test('the product catalog no longer owns provider ids or upload paths', () => {
  const source = readFileSync(
    new URL('../effects/effect-registry.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /^\s+effectId:\s*\d/m);
  assert.doesNotMatch(source, /^\s+uploadPath:\s*['"]/m);
  assert.doesNotMatch(source, /^\s+imageBucketName:\s*['"]/m);
});
