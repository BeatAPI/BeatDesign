import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./create-project-route-page.tsx', import.meta.url),
  'utf8'
);

test('visiting Studio or Canvas does not create a project automatically', () => {
  assert.doesNotMatch(source, /useEffect/);
  assert.match(source, /createProject\('studio'\)/);
  assert.match(source, /createProject\('canvas'\)/);
  assert.match(source, /appConfig\.app_logo/);
  assert.match(source, /'\/api\/app\/projects'/);
});

test('the first-run screen covers the full viewport', () => {
  assert.match(source, /min-h-screen/);
  assert.doesNotMatch(source, /min-h-\[calc\(100vh-96px\)\]/);
});
