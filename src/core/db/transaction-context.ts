import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { withSqliteCompat } from './create-db';
import { db, getLocalDatabaseUrl } from './index';

type CommandDatabase = ReturnType<typeof drizzle>;
// Service reads and writes share this connection; unrelated readers keep the root connection.
const scope = new AsyncLocalStorage<CommandDatabase>();
let queue: Promise<unknown> = Promise.resolve();
export const currentDatabaseTransaction = () => scope.getStore();

export function withDatabaseTransaction<T>(run: (tx: CommandDatabase) => Promise<T>): Promise<T> {
  const existing = scope.getStore();
  if (existing) return run(existing);
  const next = queue.catch(() => undefined).then(async () => {
    await db(); // Complete additive startup upgrades before opening a command connection.
    let client = createClient({ url: getLocalDatabaseUrl() });
    try {
      await client.execute('PRAGMA busy_timeout = 50');
      for (let attempt = 0; ; attempt++) {
        try { await client.execute('BEGIN IMMEDIATE'); break; }
        catch (error) {
          if ((error as {code?: string}).code !== 'SQLITE_BUSY' || attempt >= 19) throw error;
          // A failed prepared BEGIN can remain active in the native driver.
          // Retry with a fresh owned connection, never a detached transaction.
          client.close();
          await delay(50);
          client = createClient({url: getLocalDatabaseUrl()});
          await client.execute('PRAGMA busy_timeout = 50');
        }
      }
      const database = withSqliteCompat(drizzle({ client }));
      try {
        const result = await scope.run(database, () => run(database));
        await client.executeMultiple('COMMIT');
        return result;
      } catch (error) {
        await client.executeMultiple('ROLLBACK');
        throw error;
      }
    } finally {
      // libsql transaction() detaches its native connection; commit/close on that
      // Transaction does not release the native handle. Own the Client instead.
      client.close();
    }
  });
  queue = next;
  return next;
}
