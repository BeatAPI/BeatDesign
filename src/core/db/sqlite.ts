import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import type { DbConfig } from './types';

const isCloudflareWorker =
  typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis;

// SQLite/libsql singleton
let sqliteDbInstance: ReturnType<typeof drizzle> | null = null;

export function createSqliteDb(config: DbConfig) {
  const databaseUrl = config.database_url;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const options: Record<string, string> = {};
  if (config.database_auth_token) {
    options.authToken = config.database_auth_token;
  }

  // In Cloudflare Workers, create new connection each time
  if (isCloudflareWorker) {
    const client = createClient({
      url: databaseUrl,
      ...options,
    });
    return drizzle({ client });
  }

  // Singleton mode: reuse existing instance
  if (config.db_singleton_enabled === 'true') {
    if (sqliteDbInstance) return sqliteDbInstance;

    const client = createClient({
      url: databaseUrl,
      ...options,
    });
    sqliteDbInstance = drizzle({ client });
    return sqliteDbInstance;
  }

  // Non-singleton mode: create new connection each time
  const client = createClient({
    url: databaseUrl,
    ...options,
  });
  return drizzle({ client });
}
