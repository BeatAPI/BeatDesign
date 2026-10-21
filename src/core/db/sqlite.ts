import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { setTimeout as delay } from 'node:timers/promises';

import type { DbConfig } from './types';

// SQLite/libsql singleton
let sqliteDbInstance: Promise<ReturnType<typeof drizzle>> | null = null;
let sqliteClientInstance: ReturnType<typeof createClient> | null = null;

export async function configureLocalSqlite(
  client: ReturnType<typeof createClient>
) {
  // Keep startup lock waits short: synchronous libsql busy waits would otherwise
  // block another Web/MCP connection from finishing its migration in this process.
  await client.execute('PRAGMA busy_timeout = 50');
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await client.executeMultiple('PRAGMA journal_mode = WAL');
        const columns = await client.execute('PRAGMA table_info(project)');
        const names = new Set(columns.rows.map((row) => String(row.name)));
        if (!names.size) break;
        // Plan additive DDL, then execute it as one synchronous driver batch.
        // batch() retains its connection; transaction() detaches a native handle.
        const statements: string[] = [];
        if (!names.has('description')) statements.push("ALTER TABLE project ADD COLUMN description TEXT NOT NULL DEFAULT ''");
        if (!names.has('settings_revision')) statements.push('ALTER TABLE project ADD COLUMN settings_revision INTEGER NOT NULL DEFAULT 1');
        if (!names.has('cover_mode')) {
          statements.push("ALTER TABLE project ADD COLUMN cover_mode TEXT NOT NULL DEFAULT 'manual'");
          statements.push("UPDATE project SET cover_mode = 'auto' WHERE cover_asset_id IS NULL");
        }
        statements.push("CREATE TABLE IF NOT EXISTS project_organization_state (project_id TEXT PRIMARY KEY NOT NULL REFERENCES project(id) ON DELETE CASCADE, schema_version INTEGER NOT NULL DEFAULT 1, document_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now')-2440587.5)*86400000 as integer)))");
        statements.push("CREATE TABLE IF NOT EXISTS workflow_template (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1, definition_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (cast((julianday('now')-2440587.5)*86400000 as integer)), updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now')-2440587.5)*86400000 as integer)))");
        for (const [table, fields] of [
          ['project_command_receipt', ['request_hash']],
          ['generation_upload_intent', ['source_card_id', 'source_context_digest']],
        ] as const) {
          const columns = await client.execute(`PRAGMA table_info(${table})`);
          const existing = new Set(columns.rows.map((row) => String(row.name)));
          if (existing.size) for (const field of fields) if (!existing.has(field))
            statements.push(`ALTER TABLE ${table} ADD COLUMN ${field} TEXT`);
        }
        await client.batch(statements, 'write');
        break;
      } catch (error) {
        if (
          ((error as { code?: string }).code !== 'SQLITE_BUSY' &&
           !/duplicate column name:/i.test(error instanceof Error ? error.message : '')) ||
          attempt === 5
        )
          throw error;
        await delay(50 * (attempt + 1));
      }
    }
  } finally {
    // Restore the normal request timeout after the short startup retries.
    await client.execute('PRAGMA busy_timeout = 5000');
  }
}

export async function createSqliteDb(config: DbConfig) {
  const databaseUrl = config.database_url;
  if (!databaseUrl) {
    throw new Error('Local SQLite database path is not configured');
  }

  if (sqliteDbInstance) return sqliteDbInstance;
  const client = createClient({ url: databaseUrl });
  sqliteClientInstance = client;
  sqliteDbInstance = configureLocalSqlite(client)
    .then(() => drizzle({ client }))
    .catch((error) => {
      client.close();
      sqliteDbInstance = null;
      sqliteClientInstance = null;
      throw error;
    });
  return sqliteDbInstance;
}

/** Release the local connection before test cleanup or runtime shutdown. */
export async function closeSqliteDb() {
  const pendingDb = sqliteDbInstance;
  const client = sqliteClientInstance;
  sqliteDbInstance = null;
  sqliteClientInstance = null;
  await pendingDb?.catch(() => undefined);
  client?.close();
}
