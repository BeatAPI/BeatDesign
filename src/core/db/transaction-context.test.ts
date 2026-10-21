import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('command connections close after commit and rollback while root reads stay isolated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'beatdesign-command-close-'));
  process.env.BEATDESIGN_DATA_DIR = directory;
  const {db} = await import('./index');
  const {withDatabaseTransaction} = await import('./transaction-context');
  const {getDb} = await import('../workspace-lib/db-adapter');
  const {closeSqliteDb} = await import('./sqlite');
  const root = await db();
  const clients: Array<{closed:boolean}> = [];
  try {
    await root.$client.execute('CREATE TABLE close_probe (id TEXT)');
    await withDatabaseTransaction(async (tx) => {
      const scoped = await getDb();
      assert.equal(scoped, tx);
      assert.notEqual(scoped.$client, root.$client);
      clients.push(scoped.$client);
      await scoped.$client.execute("INSERT INTO close_probe VALUES ('committed')");
      assert.equal((await root.$client.execute('SELECT * FROM close_probe')).rows.length, 0);
    });
    assert.equal(clients[0].closed, true);
    await assert.rejects(withDatabaseTransaction(async (tx) => {
      clients.push((tx as any).$client);
      await (tx as any).$client.execute("INSERT INTO close_probe VALUES ('rolled-back')");
      throw new Error('rollback probe');
    }), /rollback probe/);
    assert.equal(clients[1].closed, true);
    assert.deepEqual((await root.$client.execute('SELECT id FROM close_probe')).rows.map((r:any)=>r.id), ['committed']);
  } finally {
    await closeSqliteDb();
    await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
});
