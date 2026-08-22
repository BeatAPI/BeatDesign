import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWorkspaceMode, workspaceModes } from './workspace-modes';

test('workspace modes expose Studio, Canvas, and Assets', () => {
  assert.deepEqual(workspaceModes, ['studio', 'canvas', 'assets']);
  assert.equal(resolveWorkspaceMode('studio'), 'studio');
  assert.equal(resolveWorkspaceMode('canvas'), 'canvas');
  assert.equal(resolveWorkspaceMode('assets'), 'assets');
  assert.equal(resolveWorkspaceMode('unknown'), 'canvas');
  assert.equal(resolveWorkspaceMode(undefined), 'canvas');
});
