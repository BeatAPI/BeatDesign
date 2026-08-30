import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getActiveGenerationProvider,
  getGenerationModelBinding,
  getGenerationModelDescriptor,
  listGenerationModelDescriptors,
} from './index';

test('BeatAPI is the default provider behind stable logical model ids', () => {
  const provider = getActiveGenerationProvider();
  const binding = getGenerationModelBinding({ modelId: 'seedance-2' });

  assert.equal(provider.id, 'beatapi');
  assert.equal(binding?.effectId, 9);
  assert.equal(binding?.upstreamModelId, 'seedance-2');
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
