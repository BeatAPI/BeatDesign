import assert from 'node:assert/strict';
import test from 'node:test';

import { hasTimelineVersionConflict } from './timeline-state';

test('timeline CAS rejects stale writers but permits an unchanged retry', () => {
  assert.equal(
    hasTimelineVersionConflict({
      currentVersion: 4,
      baseVersion: 3,
      documentChanged: true,
    }),
    true
  );
  assert.equal(
    hasTimelineVersionConflict({
      currentVersion: 4,
      baseVersion: 4,
      documentChanged: true,
    }),
    false
  );
  assert.equal(
    hasTimelineVersionConflict({
      currentVersion: 4,
      baseVersion: null,
      documentChanged: false,
    }),
    false
  );
});
