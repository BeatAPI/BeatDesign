import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWorkspaceMode, workspaceModes } from './workspace-modes';

test('workspace modes expose one canonical Studio and Canvas switch', () => {
  assert.deepEqual(workspaceModes, ['studio', 'canvas']);
  assert.equal(resolveWorkspaceMode('studio'), 'studio');
  assert.equal(resolveWorkspaceMode('canvas'), 'canvas');
  assert.equal(resolveWorkspaceMode('unknown'), 'canvas');
  assert.equal(resolveWorkspaceMode(undefined), 'canvas');
});
