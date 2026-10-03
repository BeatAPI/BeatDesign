import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import type { DbConfig } from './types';

// SQLite/libsql singleton
let sqliteDbInstance: Promise<ReturnType<typeof drizzle>> | null = null;
let sqliteClientInstance: ReturnType<typeof createClient> | null = null;

export async function configureLocalSqlite(client: ReturnType<typeof createClient>) {
  await client.execute('PRAGMA busy_timeout = 5000');
  await client.execute('PRAGMA journal_mode = WAL');
}

export async function createSqliteDb(config: DbConfig) {
  const databaseUrl = config.database_url;
  if (!databaseUrl) {
    throw new Error('Local SQLite database path is not configured');
  }

  if (sqliteDbInstance) return sqliteDbInstance;
  const client = createClient({ url: databaseUrl });
  sqliteClientInstance = client;
  sqliteDbInstance = configureLocalSqlite(client).then(() => drizzle({ client })).catch((error) => {
    client.close();
    sqliteDbInstance = null;
    sqliteClientInstance = null;
    throw error;
  });
  return sqliteDbInstance;
}

export async function closeSqliteDb() {
  const pendingDb = sqliteDbInstance;
  const client = sqliteClientInstance;
  sqliteDbInstance = null;
  sqliteClientInstance = null;

  await pendingDb?.catch(() => undefined);
  client?.close();
}
