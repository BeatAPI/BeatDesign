import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./beatapi-product-shell.tsx', import.meta.url),
  'utf8'
);

test('product shell keeps workspace navigation and hides SaaS auth', () => {
  assert.match(source, /label: copy\.home, href: '\/'/);
  assert.match(source, /label: copy\.create, href: '\/studio'/);
  assert.match(source, /href: '\/projects'/);
  assert.doesNotMatch(source, /href: '\/pricing'/);
  assert.doesNotMatch(source, /ProductSurface.*pricing/);
  assert.doesNotMatch(source, /href="\/sign-in"/);
  assert.doesNotMatch(source, /useSession/);
});
