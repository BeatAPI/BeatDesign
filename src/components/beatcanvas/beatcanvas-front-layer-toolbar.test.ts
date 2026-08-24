import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./beatcanvas-front-layer.tsx', import.meta.url),
  'utf8'
);

test('canvas toolbar stays at the bottom and hides while the composer is open', () => {
  assert.match(
    source,
    /\{!activeDraftCard \? \(\s*<div\s+className=\{cn\(\s*'pointer-events-auto absolute bottom-4 left-1\/2/
  );
  assert.doesNotMatch(
    source,
    /activeComposerCardId \? 'top-4' : 'bottom-4'/
  );
});
