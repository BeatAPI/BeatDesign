import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Drizzle and the runtime use the same default local SQLite database', () => {
  const runtimeConfig = readFileSync(
    new URL('./index.ts', import.meta.url),
    'utf8'
  );
  const drizzleConfig = readFileSync(
    new URL('../../drizzle.config.ts', import.meta.url),
    'utf8'
  );

  assert.match(runtimeConfig, /file:data\/workspace\.db/);
  assert.match(drizzleConfig, /file:data\/workspace\.db/);
  assert.doesNotMatch(drizzleConfig, /file:data\/local\.db/);
});
