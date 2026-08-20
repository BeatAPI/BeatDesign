import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./recent-assets.ts', import.meta.url), 'utf8');

test('project assets are scoped through local project membership', () => {
  assert.match(source, /getProject/);
  assert.doesNotMatch(source, /userId|requireSession/);
  assert.match(source, /projectAssetMembership/);
  assert.match(source, /eq\(projectAssetMembership\.projectId, projectId\)/);
  assert.match(source, /selectDistinct/);
});
