import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const clientModule of ['./effect-registry.ts', './workspace-models.ts']) {
  test(`${clientModule} does not load the server generation barrel`, () => {
    const source = readFileSync(new URL(clientModule, import.meta.url), 'utf8');

    assert.match(source, /@\/core\/generation-providers\/registry/);
    assert.doesNotMatch(
      source,
      /from ['"]@\/core\/generation-providers['"]/
    );
  });
}
