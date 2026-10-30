import assert from 'node:assert/strict';
import test from 'node:test';
import { getSelectableModel } from './generation-controller';
import { getWorkspaceModelsByType } from '@/core/effects/workspace-models';
import { getRegisteredEffectById } from '@/core/effects/registered-effects';
import { getGenerationModelDescriptor } from '@/core/generation-providers/model-catalog';

test('retired models remain identifiable for history but cannot silently select a different model', () => {
  const models = getWorkspaceModelsByType('ai-video');
  for (const [id, effectId] of [['happyhorse-1.0', 31], ['happyhorse-1.1', 32], ['kling-2.6-motion-control', 19], ['kling-3-motion-control', 20]] as const) {
    assert.equal(getSelectableModel(models, id), null);
    assert.equal(getGenerationModelDescriptor(id), null);
    assert.equal(getRegisteredEffectById(effectId)?.model, id);
  }
});
