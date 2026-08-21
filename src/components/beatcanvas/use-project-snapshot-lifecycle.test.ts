import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectPathWithoutEntryIntentSearch,
  buildProjectSnapshotRequestHeaders,
} from './use-project-snapshot-lifecycle';

test('removes one-time prompt and template query params without dropping other params', () => {
  const path = buildProjectPathWithoutEntryIntentSearch({
    projectPath: '/canvas/project-1',
    search: '?target=image&template=ecommerce-collage&prompt=hero&foo=bar',
  });

  assert.equal(path, '/canvas/project-1?target=image&foo=bar');
});

test('snapshot autosave includes the trusted workspace mutation marker', () => {
  assert.deepEqual(buildProjectSnapshotRequestHeaders(), {
    'content-type': 'application/json',
    'x-beatapi-workspace-request': '1',
  });
});
