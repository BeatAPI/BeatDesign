import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import type { DbConfig } from './types';

// SQLite/libsql singleton
let sqliteDbInstance: ReturnType<typeof drizzle> | null = null;

export function createSqliteDb(config: DbConfig) {
  const databaseUrl = config.database_url;
  if (!databaseUrl) {
    throw new Error('Local SQLite database path is not configured');
  }

  if (sqliteDbInstance) return sqliteDbInstance;
  const client = createClient({ url: databaseUrl });
  sqliteDbInstance = drizzle({ client });
  return sqliteDbInstance;
}
