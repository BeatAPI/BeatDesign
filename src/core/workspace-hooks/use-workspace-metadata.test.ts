import assert from 'node:assert/strict';
import test from 'node:test';

import { getEffectMetadataQueryState } from './use-workspace-metadata';

test('keeps effect metadata query disabled until the canvas is ready', () => {
  const state = getEffectMetadataQueryState(['wan-3', 'seedance-2', 'wan-3', ''], {
    enabled: false,
  });

  assert.deepEqual(state.normalizedIds, ['seedance-2', 'wan-3']);
  assert.equal(state.enabled, false);
});

test('disables effect metadata query when there are no valid effect ids', () => {
  const state = getEffectMetadataQueryState(['', '  ']);

  assert.deepEqual(state.normalizedIds, []);
  assert.equal(state.enabled, false);
});
