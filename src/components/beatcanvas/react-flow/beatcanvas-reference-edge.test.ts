import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('renders reference connectors as one solid neutral Bezier path', () => {
  const source = readFileSync(
    new URL('./beatcanvas-reference-edge.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /getBezierPath/);
  assert.equal(source.match(/<BaseEdge/g)?.length, 1);
  assert.doesNotMatch(source, /strokeDasharray/);
  assert.doesNotMatch(source, /filter:\s*['"]blur/);
  assert.doesNotMatch(source, /var\(--beat-accent\)/);
});
