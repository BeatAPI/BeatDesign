import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';

test('organization transactions roll back failed receipts, preserve pinned inputs and reject stale or foreign writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'beatdesign-organization-'));
  process.env.BEATDESIGN_DATA_DIR = directory;
  execFileSync(
    process.execPath,
    ['node_modules/drizzle-kit/bin.cjs', 'push', '--force'],
    { env: process.env, stdio: 'pipe', windowsHide: true }
  );
  const { createProject, loadProjectWithLatestSnapshot, saveProjectSnapshot } =
    await import('@/core/projects/projects');
  const { persistBeatDesignCommand } = await import('@/core/commands/persist');
  const { getOrganization, queryOrganizationAssets } =
    await import('./service');
  const { recordUserAsset, linkProjectAsset } =
    await import('@/core/workspace-lib/assets/user-assets');
  const { previewWorkflowTemplate, getWorkflowTemplate } =
    await import('@/core/workflows/service');
  const project = await createProject({ name: 'Organization fixture' });
  const foreign = await createProject({ name: 'Foreign' });
  const client = createClient({ url: `file:${directory}/local.db` });
  const apply = (id: string, revision: number, command: any) =>
    persistBeatDesignCommand({
      projectId: project.id,
      origin: 'mcp',
      commandId: id,
      idempotencyKey: id,
      expectedRevision: revision,
      command,
    });
  async function asset(id: string, projectId = project.id) {
    await recordUserAsset({
      id,
      type: 'image',
      source: 'upload',
      bucket: 'fixture',
      objectKey: id,
      publicUrl: `/fixture/${id}`,
      filename: `${id}.png`,
    });
    await linkProjectAsset({ projectId, assetId: id, role: 'upload' });
  }
  try {
    await asset('v1');
    await asset('v2');
    await asset('foreign', foreign.id);
    await linkProjectAsset({
      projectId: project.id,
      assetId: 'v1',
      role: 'generated',
    });
    const initial = await getOrganization(project.id);
    assert.equal(initial.revision, 0);
    const command = {
      type: 'organization.apply',
      operations: [
        {
          type: 'create_folder',
          folderId: 'folder',
          name: 'Shots',
          parentId: null,
        },
      ],
    };
    const [first, replay] = await Promise.all([
      apply('create', 0, command),
      apply('create', 0, command),
    ]);
    assert.equal(first.ok, true);
    assert.deepEqual(replay, first);
    const collision = await apply('create', 0, {
      ...command,
      operations: [
        {
          type: 'create_folder',
          folderId: 'folder',
          name: 'Different',
          parentId: null,
        },
      ],
    });
    assert.equal(collision.ok, false);
    const races = await Promise.all([
      apply('race1', 1, {
        type: 'organization.apply',
        operations: [{ type: 'rename_folder', folderId: 'folder', name: 'A' }],
      }),
      apply('race2', 1, {
        type: 'organization.apply',
        operations: [{ type: 'rename_folder', folderId: 'folder', name: 'B' }],
      }),
    ]);
    assert.equal(races.filter((result) => result.ok).length, 1);
    const before = await getOrganization(project.id);
    const invalid = await apply('foreign', before.revision, {
      type: 'organization.apply',
      operations: [
        { type: 'rename_folder', folderId: 'folder', name: 'Must roll back' },
        { type: 'assign_assets', assetIds: ['foreign'], folderId: 'folder' },
      ],
    });
    assert.equal(invalid.ok, false);
    assert.deepEqual(await getOrganization(project.id), before);
    await client.execute(
      "CREATE TRIGGER reject_receipt BEFORE INSERT ON project_command_receipt WHEN NEW.command_id='fail-receipt' BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END"
    );
    const failed = await apply('fail-receipt', before.revision, {
      type: 'organization.apply',
      operations: [
        {
          type: 'rename_folder',
          folderId: 'folder',
          name: 'Must also roll back',
        },
      ],
    });
    assert.equal(failed.ok, false);
    assert.deepEqual(await getOrganization(project.id), before);
    await client.execute('DROP TRIGGER reject_receipt');
    assert.equal((await queryOrganizationAssets(project.id)).assets.length, 2);
    const element = await apply('element', before.revision, {
      type: 'organization.apply',
      operations: [
        {
          type: 'create_element',
          elementId: 'hero',
          name: 'Hero',
          kind: 'character',
          description: '',
          versionId: 'one',
          assetId: 'v1',
        },
        {
          type: 'add_element_version',
          elementId: 'hero',
          versionId: 'two',
          assetId: 'v2',
        },
      ],
    });
    assert.equal(element.ok, true);
    const base = buildTextCard({
      id: 'generate',
      name: 'Shot',
      textContent: '',
    });
    const generation = {
      ...base,
      kind: 'generation' as const,
      type: 'image' as const,
      prompt: 'Hero waves',
      modelId: 'nano-banana',
    };
    const added = await apply('card', 1, {
      type: 'canvas.apply',
      operations: [
        {
          type: 'upsert_card',
          card: generation,
          frame: { x: 400, y: 0, w: 360, h: 400 },
        },
      ],
    });
    assert.equal(added.ok, true);
    const bound = await apply('bind', added.revision!, {
      type: 'canvas.apply',
      operations: [
        {
          type: 'bind_element',
          bindingId: 'binding',
          consumerCardId: 'generate',
          elementId: 'hero',
          versionId: 'one',
          assetId: 'v1',
          referenceCardId: 'hero-ref',
          order: 0,
          role: 'reference',
        },
      ],
    });
    assert.equal(bound.ok, true);
    const beforeBinding = (await loadProjectWithLatestSnapshot({
      projectId: project.id,
    }))!;
    assert.equal(
      beforeBinding.snapshot.cards.find((card) => card.id === 'hero-ref')
        ?.assetId,
      'v1'
    );
    const org = await getOrganization(project.id);
    assert.equal(
      (
        await apply('remove-used', org.revision, {
          type: 'organization.apply',
          operations: [{ type: 'remove_element', elementId: 'hero' }],
        })
      ).ok,
      false
    );
    assert.equal(
      (
        await apply('new-current', org.revision, {
          type: 'organization.apply',
          operations: [
            {
              type: 'set_element_current',
              elementId: 'hero',
              versionId: 'two',
            },
          ],
        })
      ).ok,
      true
    );
    assert.deepEqual(
      (await loadProjectWithLatestSnapshot({ projectId: project.id }))!
        .snapshot,
      beforeBinding.snapshot
    );
    await assert.rejects(
      () =>
        saveProjectSnapshot({
          projectId: project.id,
          document: { ...beforeBinding.snapshot, version: 3 },
          baseVersion: beforeBinding.snapshotVersion,
        }),
      /current client/
    );
    const preview = await previewWorkflowTemplate(project.id, ['generate']);
    const captured = await apply('capture', 0, {
      type: 'workflow.template.capture',
      templateId: 'template',
      name: 'Shot workflow',
      selectedCardIds: ['generate'],
      sourceCanvasRevision: beforeBinding.snapshotVersion,
      definitionDigest: preview.definitionDigest,
    });
    assert.equal(captured.ok, true);
    const template = await getWorkflowTemplate('template');
    assert.equal(
      JSON.stringify(template.definition).includes('/fixture/'),
      false
    );
    const inserted = await apply('insert', beforeBinding.snapshotVersion, {
      type: 'workflow.template.instantiate',
      templateId: 'template',
      templateRevision: 1,
      instanceId: 'instance',
      bindings: {},
      placement: { x: 1000, y: 0 },
    });
    assert.equal(inserted.ok, true);
    if (inserted.ok) assert.ok(inserted.data.blockers?.length);
    const count = await client.execute(
      'SELECT count(*) AS count FROM generation_history'
    );
    assert.equal(count.rows[0].count, 0);
    assert.equal(
      (
        await client.execute(
          'SELECT count(*) AS count FROM generation_upload_intent'
        )
      ).rows[0].count,
      0
    );
  } finally {
    client.close();
  }
});
