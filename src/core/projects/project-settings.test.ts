import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { configureLocalSqlite } from '@/core/db/sqlite';
import { projectSettingsPatchSchema } from './project-settings-contract';

test('settings validation rejects empty updates, blank names, long descriptions and arbitrary URLs', () => {
  for (const patch of [
    {},
    { name: '  ' },
    { description: 'a'.repeat(141) },
    { cover: { mode: 'manual', url: 'https://example.com' } },
    { slug: 'new' },
  ]) {
    assert.equal(projectSettingsPatchSchema.safeParse(patch).success, false);
  }
  assert.deepEqual(
    projectSettingsPatchSchema.parse({ description: '  Film  ' }),
    { description: 'Film' },
  );
});

test('additive SQLite upgrade preserves legacy covers and is repeatable', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'beatdesign-settings-migration-'),
  );
  const client = createClient({ url: `file:${directory}/migration.db` });
  try {
    await client.execute(
      'CREATE TABLE project (id TEXT PRIMARY KEY, cover_asset_id TEXT)',
    );
    await client.execute(
      "INSERT INTO project VALUES ('legacy', 'poster'), ('empty', NULL)",
    );
    const second = createClient({ url: `file:${directory}/migration.db` });
    try {
      await Promise.all([
        configureLocalSqlite(client),
        configureLocalSqlite(second),
      ]);
    } finally {
      second.close();
    }
    await configureLocalSqlite(client);
    const rows = (await client.execute('SELECT * FROM project ORDER BY id'))
      .rows;
    assert.equal(rows[0].cover_mode, 'auto');
    assert.equal(rows[1].cover_mode, 'manual');
    assert.equal(rows[1].cover_asset_id, 'poster');
    assert.equal(rows[1].settings_revision, 1);
    assert.equal(rows[1].description, '');
  } finally {
    client.close();
  }
});

test('project settings persist through the command kernel, lock covers and reject stale or foreign writes', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'beatdesign-project-settings-'),
  );
  process.env.BEATDESIGN_DATA_DIR = directory;
  execFileSync(
    process.execPath,
    ['node_modules/drizzle-kit/bin.cjs', 'push', '--force'],
    { env: process.env, stdio: 'pipe' },
  );
  const { createProject, loadProjects, deleteProjects } = await import(
    './projects'
  );
  const { getProjectSettings } = await import('./project-settings');
  const { persistBeatDesignCommand } = await import('@/core/commands/persist');
  const { recordUserAsset, linkProjectAsset, deleteUserAssetById } =
    await import('@/core/workspace-lib/assets/user-assets');
  const first = await createProject({ name: 'Original' });
  const other = await createProject({ name: 'Other' });
  async function asset(
    id: string,
    projectId = first.id,
    type: 'image' | 'video' = 'image',
  ) {
    await recordUserAsset({
      id,
      type,
      source: 'upload',
      bucket: 'local-project-assets',
      objectKey: id,
      publicUrl: `/media/${id}`,
      filename: `${id}.png`,
    });
    await linkProjectAsset({ projectId, assetId: id, role: 'upload' });
    return id;
  }
  const update = (patch: any, revision: number, commandId: string) =>
    persistBeatDesignCommand({
      projectId: first.id,
      origin: 'mcp',
      commandId,
      expectedRevision: revision,
      command: { type: 'project.update', patch },
    });
  await asset('a-first');
  await asset('b-poster');
  assert.equal((await getProjectSettings(first.id))?.coverAssetId, 'a-first');
  const saved = await update(
    {
      name: 'Film',
      description: 'A short film',
      cover: { mode: 'manual', assetId: 'b-poster' },
    },
    1,
    'save-settings',
  );
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, 2);
  assert.deepEqual(
    await update(
      {
        name: 'Film',
        description: 'A short film',
        cover: { mode: 'manual', assetId: 'b-poster' },
      },
      1,
      'save-settings',
    ),
    saved,
  );
  await asset('c-later');
  await linkProjectAsset({
    projectId: first.id,
    assetId: 'c-later',
    role: 'generated',
  });
  assert.equal((await getProjectSettings(first.id))?.coverAssetId, 'b-poster');
  const stale = await update({ name: 'Lost update' }, 1, 'stale-save');
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'REVISION_CONFLICT');
  await asset('foreign', other.id);
  await asset('video', first.id, 'video');
  for (const id of ['foreign', 'video', 'missing']) {
    const invalid = await update(
      { cover: { mode: 'manual', assetId: id } },
      2,
      `invalid-${id}`,
    );
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.code, 'INVALID_COMMAND');
  }
  assert.equal((await getProjectSettings(first.id))?.settingsRevision, 2);
  assert.equal(
    (await update({ cover: { mode: 'auto' } }, 2, 'auto-cover')).ok,
    true,
  );
  assert.equal((await getProjectSettings(first.id))?.coverAssetId, 'a-first');
  assert.equal(
    (
      await update(
        { cover: { mode: 'manual', assetId: 'b-poster' } },
        3,
        'manual-again',
      )
    ).ok,
    true,
  );
  await deleteUserAssetById('b-poster');
  const fallback = await getProjectSettings(first.id);
  assert.equal(fallback?.coverMode, 'auto');
  assert.equal(fallback?.coverAssetId, 'a-first');
  const listed = (await loadProjects({})).find(
    (item: any) => item.id === first.id,
  );
  assert.equal(listed?.coverImageUrl, '/media/a-first');
  assert.equal(listed?.description, 'A short film');
  assert.equal(listed?.name, 'Film');
  const concurrent = await Promise.all([
    update({ description: 'Concurrent A' }, 4, 'concurrent-a'),
    update({ description: 'Concurrent B' }, 4, 'concurrent-b'),
  ]);
  assert.equal(concurrent.filter((result) => result.ok).length, 1);
  const rejected = concurrent.find((result) => !result.ok);
  assert.equal(
    rejected && !rejected.ok ? rejected.code : null,
    'REVISION_CONFLICT',
  );
  await deleteProjects({ projectIds: [first.id] });
  assert.equal(await getProjectSettings(first.id), null);
  const deleted = await update({ name: 'Restore' }, 4, 'deleted-save');
  assert.equal(deleted.ok, false);
  if (!deleted.ok) assert.equal(deleted.code, 'NOT_FOUND');
});
