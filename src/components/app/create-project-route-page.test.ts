import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateProjectRoutePage } from './create-project-route-page';

const source = readFileSync(
  new URL('./create-project-route-page.tsx', import.meta.url),
  'utf8'
);

test('visiting Studio or Canvas does not create a project automatically', () => {
  assert.doesNotMatch(source, /useEffect/);
  const hook = readFileSync(
    new URL(
      '../../core/workspace-hooks/use-create-project.ts',
      import.meta.url
    ),
    'utf8'
  );
  assert.doesNotMatch(hook, /useEffect/);
  assert.match(
    source,
    /onClick=\{\(\) => void createProject\(workspaceMode\)\}/
  );
  assert.match(source, /appConfig\.app_logo/);
});

test('direct entry only offers the workspace selected by its route', () => {
  for (const workspaceMode of ['studio', 'canvas'] as const) {
    const html = renderToStaticMarkup(
      createElement(CreateProjectRoutePage, {
        data: {
          locale: 'en',
          target: null,
          model: null,
          prompt: null,
          projectName: 'Entry test',
          workspaceMode,
        },
      })
    );
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
    assert.ok(
      html.includes(
        workspaceMode === 'canvas' ? 'Create in Canvas' : 'Create in Studio'
      )
    );
    assert.ok(
      !html.includes(
        workspaceMode === 'canvas' ? 'Create in Studio' : 'Create in Canvas'
      )
    );
    assert.ok(!html.includes('Choose Studio or Canvas'));
  }
});

test('the first-run screen covers the full viewport', () => {
  assert.match(source, /min-h-screen/);
  assert.doesNotMatch(source, /min-h-\[calc\(100vh-96px\)\]/);
});
