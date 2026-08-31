import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

test('workspace shell exposes projects, Studio, Canvas, assets, and provider configuration', () => {
  const source = read('src/components/app/product-page-shell.tsx');
  assert.match(source, /href="\/"/);
  assert.match(source, /\/studio\//);
  assert.match(source, /\/canvas\//);
  assert.match(source, /\/assets\//);
  assert.match(source, /WorkspaceApiConfigDialog/);
});
