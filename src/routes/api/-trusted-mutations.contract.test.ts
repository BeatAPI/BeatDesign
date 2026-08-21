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

const multipartMutationRoutes = ['./app/projects/$projectId/assets/index.ts'];

test('canvas effect mutations send the workspace request header', () => {
  const source = readFileSync(
    new URL('../../core/effects/client-api.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /WORKSPACE_MUTATION_HEADER/);
  assert.match(source, /\/api\/effects\/precheck/);
  assert.match(source, /\/api\/effects\/generate/);
});

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

test('workspace multipart mutation routes enforce the same-origin request contract', () => {
  for (const route of multipartMutationRoutes) {
    const source = readFileSync(new URL(route, import.meta.url), 'utf8');
    assert.match(
      source,
      /validateTrustedWorkspaceMutation\(request\)/,
      `${route} must validate the workspace mutation request`
    );
    assert.match(source, /multipart\/form-data/);
  }
});
