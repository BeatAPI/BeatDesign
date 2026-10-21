/** Apply trusted packaged DDL and its receipt atomically. Runtime upgrades may
 * already have added columns/tables before their first versioned migration. */
export async function applyRuntimeMigration(client, name, source) {
  await client.execute('BEGIN IMMEDIATE');
  const tx = client;
  try {
    for (const statement of source.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)) {
      const addedColumn = /^ALTER TABLE\s+`(\w+)`\s+ADD\s+`(\w+)`\s/i.exec(statement);
      if (addedColumn) {
        const columns = await tx.execute(`PRAGMA table_info(\`${addedColumn[1]}\`)`);
        if (columns.rows.some((row) => row.name === addedColumn[2])) continue;
      }
      // DDL is packaged maintainer SQL, never request input. Schema-aware repeats
      // tolerate the same additive tables created by source-mode startup.
      const sql = statement.replace(/^CREATE TABLE\s+(?!IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ').replace(/^CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS)/i, (_, unique = '') => `CREATE ${unique}INDEX IF NOT EXISTS `);
      await tx.execute(sql);
    }
    await tx.execute({sql:'INSERT INTO __beatdesign_runtime_migrations (name, applied_at) VALUES (?, ?)',args:[name, Date.now()]});
    await tx.executeMultiple('COMMIT');
  } catch (error) {
    await tx.executeMultiple('ROLLBACK');
    throw error;
  }
}
