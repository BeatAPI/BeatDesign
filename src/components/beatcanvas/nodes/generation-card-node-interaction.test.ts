import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./generation-card-node.tsx', import.meta.url),
  'utf8'
);

test('generation media remains a full-card drag surface', () => {
  assert.match(source, /className="group cursor-grab active:cursor-grabbing"/);
  assert.match(
    source,
    /<video[\s\S]*?preload="metadata"\s+className="nowheel"/
  );
  assert.match(
    source,
    /<img[\s\S]*?draggable=\{false\}\s+className="nowheel"/
  );
});

test('generation node leaves prompt and parameters to the attached Composer', () => {
  assert.doesNotMatch(source, /shapeCopy\.versions/);
  assert.doesNotMatch(source, /latestModelLabel/);
  assert.doesNotMatch(source, /latestOutputQuality/);
  assert.match(source, /latestOutputUrl/);
  assert.match(source, /beatcanvas:pin-generation-output/);
  assert.match(source, /Take \$\{take\.takeNumber\}/);
});
