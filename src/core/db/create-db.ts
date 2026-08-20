import { createD1Db } from './d1';
import { createSqliteDb } from './sqlite';
import type { DbConfig } from './types';

const sqliteCompatProxyCache = new WeakMap<object, any>();

/**
 * SQLite/D1 compatibility shim used by the D1 runtime and local test fixture.
 * It keeps the service layer dialect-neutral without advertising another
 * production database.
 */
function withSqliteCompat<T extends object>(
  dbInstance: T,
  provider?: string
): T {
  if (dbInstance && typeof dbInstance === 'object') {
    const cached = sqliteCompatProxyCache.get(dbInstance);
    if (cached) return cached as T;
  }

  const wrapQuery = (query: any) => {
    if (!query || typeof query !== 'object') return query;

    return new Proxy(query, {
      get(target, prop, receiver) {
        if (prop === 'for' && typeof target.for !== 'function') {
          return () => receiver;
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;

        return (...args: any[]) => wrapQuery(value.apply(target, args));
      },
    });
  };

  const proxied = new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === 'transaction') {
        if (provider === 'd1') {
          return (fn: any) => fn(proxied);
        }
        const original = Reflect.get(target, prop, receiver);
        if (typeof original !== 'function') return original;
        return (fn: any, ...rest: any[]) =>
          original.call(
            target,
            (tx: any) => fn(withSqliteCompat(tx, provider)),
            ...rest
          );
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      if (typeof prop === 'string' && prop.startsWith('select')) {
        return (...args: any[]) => wrapQuery(value.apply(target, args));
      }

      return value.bind(target);
    },
  }) as T;

  sqliteCompatProxyCache.set(dbInstance, proxied);
  return proxied;
}

export function createDb(config: DbConfig): any {
  if (config.database_provider === 'd1') {
    return withSqliteCompat(createD1Db() as any, 'd1');
  }

  if (config.database_provider === 'sqlite') {
    return withSqliteCompat(createSqliteDb(config) as any, 'sqlite');
  }

  throw new Error(
    'Unsupported DATABASE_PROVIDER=' +
      config.database_provider +
      '. Use sqlite or d1.'
  );
}

export async function closeDb(_config: DbConfig) {}
