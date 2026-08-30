import { createDb } from './create-db';
import { appConfig } from '@/config';

let dbInstance: any = null;

export function db() {
  if (dbInstance) return dbInstance;

  const instance = createDb({
    database_url: appConfig.database_url,
  });

  dbInstance = instance;

  return instance;
}

export type { DbConfig } from './types';
export { createDb, closeDb } from './create-db';
