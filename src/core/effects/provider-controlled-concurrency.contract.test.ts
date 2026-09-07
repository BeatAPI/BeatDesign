import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const submitGeneration = readFileSync(
  new URL('./submit-generation.ts', import.meta.url),
  'utf8'
);
const precheck = readFileSync(
  new URL('../../routes/api/effects/precheck.ts', import.meta.url),
  'utf8'
);

test('BeatDesign delegates account concurrency across projects to the generation provider', () => {
  for (const source of [submitGeneration, precheck]) {
    assert.doesNotMatch(source, /resolveGenerationConcurrencyGate/);
    assert.doesNotMatch(source, /ANOTHER_PROJECT_RUNNING|PROJECT_CONCURRENCY_LIMIT/);
  }
});
