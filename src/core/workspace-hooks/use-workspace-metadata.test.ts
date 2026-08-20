import assert from 'node:assert/strict';
import test from 'node:test';

import { getEffectMetadataQueryState } from './use-workspace-metadata';

test('keeps effect metadata query disabled until the canvas is ready', () => {
  const state = getEffectMetadataQueryState([3, 1, 3, Number.NaN], {
    enabled: false,
  });

  assert.deepEqual(state.normalizedIds, [1, 3]);
  assert.equal(state.enabled, false);
});

test('disables effect metadata query when there are no valid effect ids', () => {
  const state = getEffectMetadataQueryState([Number.NaN, Number.POSITIVE_INFINITY]);

  assert.deepEqual(state.normalizedIds, []);
  assert.equal(state.enabled, false);
});
