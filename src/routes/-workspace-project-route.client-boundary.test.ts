import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const routeFile of ['./studio/$projectId.tsx', './canvas/$projectId.tsx']) {
  test(`keeps ${routeFile} data-loaded but client rendered`, () => {
    const source = readFileSync(new URL(routeFile, import.meta.url), 'utf8');

    assert.match(source, /ssr:\s*['"]data-only['"]/);
  });
}
