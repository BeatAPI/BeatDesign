import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('asset image cards expose a double-click preview event without previewing svg structure cards', () => {
  const source = readFileSync(
    new URL('./asset-card-node.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /onDoubleClick/);
  assert.match(source, /beatcanvas:preview-media/);
  assert.match(source, /!thumbnailUrl\.startsWith\('data:image\/svg\+xml'\)/);
});
