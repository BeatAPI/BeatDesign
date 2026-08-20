import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mutationRoutes = [
  './app/projects/index.ts',
  './app/projects/$projectId.ts',
  './app/projects/$projectId/snapshot.ts',
  './effects/precheck.ts',
  './effects/generate.ts',
];

test('workspace JSON mutation routes enforce the same-origin request contract', () => {
  for (const route of mutationRoutes) {
    const source = readFileSync(new URL(route, import.meta.url), 'utf8');
    assert.match(
      source,
      /validateTrustedWorkspaceJsonMutation\(request\)/,
      `${route} must validate the workspace mutation request`
    );
  }
});
