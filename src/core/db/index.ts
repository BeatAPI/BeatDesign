import { createDb } from './create-db';
import { appConfig } from '@/config';
import { getBeatDesignDatabaseUrl } from '@/config/data-root';

let dbInstance: any = null;

export function db() {
  if (dbInstance) return dbInstance;

  const instance = createDb({
    database_url: process.env.BEATDESIGN_DATA_DIR?.trim()
      ? getBeatDesignDatabaseUrl()
      : appConfig.database_url,
  });

  dbInstance = instance;

  return instance;
}

export type { DbConfig } from './types';
export { createDb, closeDb } from './create-db';
