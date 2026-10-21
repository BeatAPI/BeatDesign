import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from './index';

// All service reads in a command see the same transaction, including legacy helpers.
const scope = new AsyncLocalStorage<any>();
let queue: Promise<unknown> = Promise.resolve();
export const currentDatabaseTransaction = () => scope.getStore();
export function withDatabaseTransaction<T>(
  run: (tx: any) => Promise<T>
): Promise<T> {
  const existing = scope.getStore();
  if (existing) return run(existing);
  const next = queue
    .catch(() => undefined)
    .then(async () => {
      const database = await db();
      return database.transaction((tx: any) => scope.run(tx, () => run(tx)), {
        behavior: 'immediate',
      });
    });
  queue = next;
  return next;
}
