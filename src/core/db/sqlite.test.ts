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
    await rm(directory, { recursive: true, force: true });
  }
});
