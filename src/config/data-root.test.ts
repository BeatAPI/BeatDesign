import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  getBeatDesignDatabaseUrl,
  getBeatDesignDataRoot,
} from './data-root';

test('uses the repository data directory by default', () => {
  const repositoryRoot = resolve('fixtures/beatdesign-repository');
  assert.equal(
    getBeatDesignDataRoot(repositoryRoot, undefined),
    resolve(repositoryRoot, 'data')
  );
  assert.equal(
    getBeatDesignDatabaseUrl(repositoryRoot, undefined),
    'file:data/local.db'
  );
});

test('uses an explicit application-data directory for packaged runtimes', () => {
  const configuredRoot = resolve('fixtures/beatdesign-user-data');
  assert.equal(
    getBeatDesignDataRoot(resolve('fixtures/ignored'), configuredRoot),
    configuredRoot
  );
  assert.equal(
    getBeatDesignDatabaseUrl(resolve('fixtures/ignored'), configuredRoot),
    `file:${resolve(configuredRoot, 'local.db')}`
  );
});
