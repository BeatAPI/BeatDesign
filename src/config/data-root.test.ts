import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBeatDesignDatabaseUrl,
  getBeatDesignDataRoot,
} from './data-root';

test('uses the repository data directory by default', () => {
  assert.equal(
    getBeatDesignDataRoot('/tmp/beatdesign-repository', undefined),
    '/tmp/beatdesign-repository/data'
  );
  assert.equal(
    getBeatDesignDatabaseUrl('/tmp/beatdesign-repository', undefined),
    'file:data/local.db'
  );
});

test('uses an explicit application-data directory for packaged runtimes', () => {
  assert.equal(
    getBeatDesignDataRoot('/tmp/ignored', '/tmp/beatdesign-user-data'),
    '/tmp/beatdesign-user-data'
  );
  assert.equal(
    getBeatDesignDatabaseUrl('/tmp/ignored', '/tmp/beatdesign-user-data'),
    'file:/tmp/beatdesign-user-data/local.db'
  );
});
