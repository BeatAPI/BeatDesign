import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyRuntimeMigration } from '../../../integrations/workbuddy/runtime/migrations.mjs';

test('packaged migrations upgrade previously auto-upgraded databases without changing user data', async () => {
  const directory = await mkdtemp(join(tmpdir(),'beatdesign-migration-'));
  const client = createClient({url:`file:${join(directory,'local.db')}`});
  try {
    await client.execute('CREATE TABLE __beatdesign_runtime_migrations (name TEXT PRIMARY KEY, applied_at INTEGER)');
    for (const file of ['0000_past_mordo.sql','0001_tiresome_xavin.sql','0002_lethal_micromacro.sql','0003_slow_the_phantom.sql']) {
      await applyRuntimeMigration(client, file, await readFile(`drizzle/sqlite/${file}`, 'utf8'));
    }
    await client.execute("INSERT INTO project(id,name) VALUES ('existing','Keep this project')");
    await client.execute("ALTER TABLE project ADD COLUMN description TEXT NOT NULL DEFAULT ''");
    await client.execute("ALTER TABLE project ADD COLUMN cover_mode TEXT NOT NULL DEFAULT 'manual'");
    await client.execute('ALTER TABLE project ADD COLUMN settings_revision INTEGER NOT NULL DEFAULT 1');
    const migration = await readFile('drizzle/sqlite/0004_majestic_thing.sql','utf8');
    await applyRuntimeMigration(client,'0004_majestic_thing.sql',migration);
    assert.equal((await client.execute("SELECT name FROM project WHERE id='existing'")).rows[0].name,'Keep this project');
    assert.equal((await client.execute('PRAGMA table_info(generation_upload_intent)')).rows.some((r) => r.name === 'source_context_digest'), true);
    // Source-mode startup can have already created the new schema without a journal receipt.
    await client.execute("DELETE FROM __beatdesign_runtime_migrations WHERE name='0004_majestic_thing.sql'");
    await applyRuntimeMigration(client,'0004_majestic_thing.sql',migration);
    await assert.rejects(applyRuntimeMigration(client,'broken','CREATE TABLE rollback_probe(id TEXT);\n--> statement-breakpoint\nINVALID SQL'));
    assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE name='rollback_probe'")).rows.length,0);
  } finally {client.close(); await rm(directory,{recursive:true,force:true});}
});
