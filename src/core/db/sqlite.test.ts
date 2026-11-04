import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import test from 'node:test';
import { configureLocalSqlite } from './sqlite';

test('local SQLite uses WAL and a busy timeout on each connection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'beatdesign-sqlite-'));
  const clients = [createClient({ url: `file:${directory}/test.db` }), createClient({ url: `file:${directory}/test.db` })];
  try {
    for (const client of clients) {
      await configureLocalSqlite(client);
      assert.equal((await client.execute('PRAGMA journal_mode')).rows[0].journal_mode, 'wal');
      assert.equal((await client.execute('PRAGMA busy_timeout')).rows[0].timeout, 5000);
    }
    await clients[0].execute('CREATE TABLE test (id INTEGER)');
    await clients[0].execute('INSERT INTO test VALUES (1)');
    assert.equal((await clients[1].execute('SELECT id FROM test')).rows[0].id, 1);
  } finally {
    clients.forEach((client) => client.close());
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    });
  }
});

test('startup retries stale WAL snapshots, re-reads schema and preserves user data', async (t) => {
  const client = createClient({ url: ':memory:' });
  try {
    await client.execute('CREATE TABLE project (id TEXT PRIMARY KEY, cover_asset_id TEXT)');
    await client.execute("INSERT INTO project VALUES ('existing', NULL)");
    const batch = client.batch.bind(client);
    let attempts = 0;
    const reads = t.mock.method(client, 'execute');
    t.mock.method(client, 'batch', async (...args: Parameters<typeof client.batch>) => {
      if (++attempts === 1) throw Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY_SNAPSHOT' });
      return batch(...args);
    });
    await configureLocalSqlite(client);
    assert.equal(attempts, 2);
    assert.equal(reads.mock.calls.filter(({ arguments: args }) => args[0] === 'PRAGMA table_info(project)').length, 2);
    assert.equal((await client.execute('SELECT id, cover_mode FROM project')).rows[0].id, 'existing');
    assert.equal((await client.execute('SELECT cover_mode FROM project')).rows[0].cover_mode, 'auto');
    assert.equal((await client.execute('PRAGMA busy_timeout')).rows[0].timeout, 5000);
  } finally { client.close(); }
});

test('startup retries remain bounded and never swallow non-lock failures', async (t) => {
  for (const [code, attempts] of [['SQLITE_BUSY_SNAPSHOT', 6], ['SQLITE_CORRUPT', 1]] as const) {
    const client = createClient({ url: ':memory:' });
    try {
      const failure = Object.assign(new Error('startup failure'), { code });
      const calls = t.mock.method(client, 'executeMultiple', async () => { throw failure; });
      await assert.rejects(configureLocalSqlite(client), (error) => error === failure);
      assert.equal(calls.mock.callCount(), attempts);
      assert.equal((await client.execute('PRAGMA busy_timeout')).rows[0].timeout, 5000);
    } finally { client.close(); }
  }
});
