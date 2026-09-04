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

test('canvas composer opens from generation-card hover intent instead of selection', () => {
  assert.match(source, /registerGenerationCardHoverCallback/);
  assert.match(source, /COMPOSER_HOVER_OPEN_DELAY_MS = 140/);
  assert.match(source, /COMPOSER_HOVER_CLOSE_DELAY_MS = 220/);
  assert.match(source, /hoveredComposerCardId/);
  assert.match(source, /onComposerPointerChange=\{handleComposerPointerChange\}/);
  assert.match(source, /onComposerFocusChange=\{handleComposerFocusChange\}/);
  assert.doesNotMatch(source, /resolveComposerFocusLayout/);
});
