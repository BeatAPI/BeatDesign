import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../scripts/with-env.ts', import.meta.url),
  'utf8'
);

test('the environment wrapper forwards arguments without a shell', () => {
  assert.match(source, /spawnSync\(command, commandArgs/);
  assert.match(source, /shell: false/);
  assert.doesNotMatch(source, /execSync/);
  assert.doesNotMatch(source, /args\.join\(' '\).*exec/);
});
