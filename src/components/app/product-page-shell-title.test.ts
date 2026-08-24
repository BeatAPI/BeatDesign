import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('project title field uses the available header width instead of a short character cap', () => {
  const source = readFileSync(
    new URL('./product-page-shell.tsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /20\)\}ch/);
  assert.doesNotMatch(source, /maxLength=/);
  assert.match(source, /className="flex min-w-0 flex-1 items-center gap-3"/);
  assert.match(source, /className="min-w-0 flex-1"/);
  assert.match(source, /className="h-9 w-full/);
});

test('editing a title is not reset by an unstable translation function identity', () => {
  const source = readFileSync(
    new URL('./product-page-shell.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const untitledWorkspaceName = t\('header\.untitledCanvas'\)/);
  assert.match(source, /\[untitledWorkspaceName\]/);
  assert.doesNotMatch(source, /\[t\]\s*\n\s*\)/);
});
