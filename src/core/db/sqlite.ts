import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import type { DbConfig } from './types';

// SQLite/libsql singleton
let sqliteDbInstance: Promise<ReturnType<typeof drizzle>> | null = null;

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
  sqliteDbInstance = configureLocalSqlite(client).then(() => drizzle({ client })).catch((error) => {
    client.close();
    sqliteDbInstance = null;
    throw error;
  });
  return sqliteDbInstance;
}
