import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { after, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import type { BeatDesignCommand } from '@/core/commands/executor';

const directory = await mkdtemp(
  join(tmpdir(), 'beatdesign-workflow-service-test-')
);
process.env.BEATDESIGN_DATA_DIR = directory;
execFileSync(
  process.execPath,
  ['node_modules/drizzle-kit/bin.cjs', 'push', '--force'],
  { env: process.env, stdio: 'pipe', windowsHide: true }
);
const { createProject, loadProjectWithLatestSnapshot, saveProjectSnapshot } =
  await import('@/core/projects/projects');
const { createEmptyProjectSnapshot } =
  await import('@/core/projects/project-snapshot');
const { recordUserAsset, linkProjectAsset } =
  await import('@/core/workspace-lib/assets/user-assets');
const { getDb } = await import('@/core/workspace-lib/db-adapter');
const { project, projectCommandReceipt } = await import('@/config/db/schema');
const { persistBeatDesignCommand } = await import('@/core/commands/persist');
const { getOrganization } = await import('@/core/organization/service');
const { getActiveGenerationProvider } =
  await import('@/core/generation-providers/registry');
const {
  previewWorkflowTemplate,
  getWorkflowTemplate,
  previewWorkflowInstantiation,
} = await import('./service');
const provider = getActiveGenerationProvider();
const originalAdapter = provider.createAdapter;
const originalConfigured = provider.assertConfigured;
let modelCalls = 0;
provider.createAdapter = () => {
  modelCalls++;
  throw new Error('Model calls are forbidden in workflow organization tests.');
};
provider.assertConfigured = async () => {
  modelCalls++;
  throw new Error('Provider readiness is irrelevant to workflow organization.');
};
after(async () => {
  provider.createAdapter = originalAdapter;
  provider.assertConfigured = originalConfigured;
  (await getDb()).$client.close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
});
const id = (prefix: string) => `${prefix}-${randomUUID()}`;
async function execute(
  projectId: string,
  command: BeatDesignCommand,
  expectedRevision: number,
  commandId = id('command')
) {
  return persistBeatDesignCommand({
    projectId,
    origin: 'mcp',
    commandId,
    idempotencyKey: commandId,
    expectedRevision,
    command,
  });
}
async function asset(projectId: string) {
  const assetId = id('asset');
  await recordUserAsset({
    id: assetId,
    type: 'image',
    source: 'upload',
    bucket: 'fixture',
    objectKey: assetId,
    publicUrl: `/api/app/projects/${projectId}/assets/${assetId}`,
    filename: 'Synthetic.png',
    storageProvider: 'local',
  });
  await linkProjectAsset({ projectId, assetId, role: 'upload' });
  return assetId;
}
async function fixture() {
  const source = await createProject({ name: 'Synthetic template source' });
  const assetId = await asset(source.id);
  const reference = {
    ...buildTextCard({ id: 'source-image', name: 'Synthetic character' }),
    kind: 'asset',
    type: 'image',
    assetId,
    url: `/api/app/projects/${source.id}/assets/${assetId}`,
  } as CanvasCard;
  const note = buildTextCard({
    id: 'direction',
    name: 'Direction',
    textContent: 'Synthetic local fixture',
  });
  const generation = {
    ...buildTextCard({ id: 'generation', name: 'Synthetic generation' }),
    kind: 'generation',
    type: 'image',
    prompt: 'Synthetic fixture',
    modelId: 'nano-banana',
    sourceGenerationId: 'private-old-task',
    referenceCardIds: [reference.id, note.id],
  } as CanvasCard;
  const state = await loadProjectWithLatestSnapshot({ projectId: source.id });
  await saveProjectSnapshot({
    projectId: source.id,
    baseVersion: state!.snapshotVersion,
    document: {
      ...createEmptyProjectSnapshot(),
      cards: [reference, note, generation],
    },
  });
  const preview = await previewWorkflowTemplate(source.id, [
    reference.id,
    note.id,
    generation.id,
  ]);
  const templateId = id('template');
  const captured = await execute(
    source.id,
    {
      type: 'workflow.template.capture',
      templateId,
      name: 'Synthetic workflow',
      selectedCardIds: [reference.id, note.id, generation.id],
      sourceCanvasRevision: preview.sourceCanvasRevision,
      definitionDigest: preview.definitionDigest,
    },
    0
  );
  assert.equal(captured.ok, true, JSON.stringify(captured));
  const target = await createProject({ name: 'Synthetic template target' });
  return { source, target, templateId, assetId, preview };
}

test('template capture allowlists private source state and survives physical source deletion', async () => {
  const data = await fixture();
  const stored = await getWorkflowTemplate(data.templateId);
  const json = JSON.stringify(stored.definition);
  for (const value of [
    data.source.id,
    data.assetId,
    'private-old-task',
    '/api/app/projects/',
    'sourceGenerationId',
  ])
    assert.equal(json.includes(value), false, value);
  await (await getDb()).delete(project).where(eq(project.id, data.source.id));
  assert.equal(
    (await getWorkflowTemplate(data.templateId)).id,
    data.templateId
  );
  assert.equal(modelCalls, 0);
});

test('receipt eviction replays an unbound instance after template deletion and retains blockers', async () => {
  const data = await fixture();
  const state = await loadProjectWithLatestSnapshot({
    projectId: data.target.id,
  });
  const command = {
    type: 'workflow.template.instantiate' as const,
    templateId: data.templateId,
    templateRevision: 1,
    instanceId: id('instance'),
    bindings: {},
    placement: { x: 100, y: 100 },
  };
  const commandId = id('instantiate');
  const created = await execute(
    data.target.id,
    command,
    state!.snapshotVersion,
    commandId
  );
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.ok(created.ok && created.data.blockers?.length);
  const removed = await execute(
    data.target.id,
    { type: 'workflow.template.remove', templateId: data.templateId },
    1
  );
  assert.equal(removed.ok, true, JSON.stringify(removed));
  await (await getDb())
    .delete(projectCommandReceipt)
    .where(
      and(
        eq(projectCommandReceipt.projectId, data.target.id),
        eq(projectCommandReceipt.commandId, commandId)
      )
    );
  const before = await loadProjectWithLatestSnapshot({
    projectId: data.target.id,
  });
  const replay = await execute(
    data.target.id,
    command,
    state!.snapshotVersion,
    commandId
  );
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.ok(replay.ok && replay.data.blockers?.length);
  assert.deepEqual(
    (await loadProjectWithLatestSnapshot({ projectId: data.target.id }))
      ?.snapshot,
    before?.snapshot
  );
  const different = await execute(
    data.target.id,
    command,
    before!.snapshotVersion,
    id('different-command')
  );
  assert.equal(different.ok, false);
  assert.equal(modelCalls, 0);
});

test('foreign target bindings and preview capacity failures leave no cards or success receipt', async () => {
  const data = await fixture();
  const before = await loadProjectWithLatestSnapshot({
    projectId: data.target.id,
  });
  const commandId = id('foreign');
  const command = {
    type: 'workflow.template.instantiate' as const,
    templateId: data.templateId,
    templateRevision: 1,
    instanceId: id('instance'),
    bindings: {
      [data.preview.definition.slots[0].id]: { assetId: data.assetId },
    },
    placement: { x: 0, y: 0 },
  };
  const rejected = await execute(
    data.target.id,
    command,
    before!.snapshotVersion,
    commandId
  );
  assert.equal(rejected.ok, false);
  assert.deepEqual(
    (await loadProjectWithLatestSnapshot({ projectId: data.target.id }))
      ?.snapshot,
    before?.snapshot
  );
  const receipts = await (await getDb())
    .select()
    .from(projectCommandReceipt)
    .where(eq(projectCommandReceipt.commandId, commandId));
  assert.equal(receipts.length, 0);
  const cards = Array.from({ length: 199 }, (_, index) =>
    buildTextCard({ id: `existing-${index}`, name: `Synthetic ${index}` })
  );
  await saveProjectSnapshot({
    projectId: data.target.id,
    baseVersion: before!.snapshotVersion,
    document: { ...createEmptyProjectSnapshot(), cards },
  });
  const beforePreview = await loadProjectWithLatestSnapshot({
    projectId: data.target.id,
  });
  await assert.rejects(
    () =>
      previewWorkflowInstantiation(data.target.id, {
        ...command,
        bindings: {},
      }),
    /200|at most/i
  );
  assert.deepEqual(
    (await loadProjectWithLatestSnapshot({ projectId: data.target.id }))
      ?.snapshot,
    beforePreview?.snapshot
  );
  assert.equal(modelCalls, 0);
});

for (const removalFirst of [false, true])
  test(`concurrent late template Element binding/removal preserves references (${removalFirst ? 'removal' : 'binding'} first)`, async () => {
    const data = await fixture();
    const assetId = await asset(data.target.id);
    const elementId = id('element'),
      versionId = id('version');
    const elementCreated = await execute(
      data.target.id,
      {
        type: 'organization.apply',
        operations: [
          {
            type: 'create_element',
            elementId,
            name: 'Synthetic character',
            kind: 'character',
            description: '',
            versionId,
            assetId,
          },
        ],
      },
      0
    );
    assert.equal(elementCreated.ok, true, JSON.stringify(elementCreated));
    const state = await loadProjectWithLatestSnapshot({
      projectId: data.target.id,
    });
    const instanceId = id('instance');
    const instanceCreated = await execute(
      data.target.id,
      {
        type: 'workflow.template.instantiate',
        templateId: data.templateId,
        templateRevision: 1,
        instanceId,
        bindings: {},
        placement: { x: 0, y: 0 },
      },
      state!.snapshotVersion
    );
    assert.equal(instanceCreated.ok, true, JSON.stringify(instanceCreated));
    const before = await loadProjectWithLatestSnapshot({
      projectId: data.target.id,
    });
    const bind = {
      type: 'canvas.apply' as const,
      operations: [
        {
          type: 'bind_template_slot' as const,
          instanceId,
          slotId: data.preview.definition.slots[0].id,
          binding: {
            assetId,
            elementId,
            versionId,
            referenceCardId: id('bound-reference'),
          },
        },
      ],
    };
    const remove = {
      type: 'organization.apply' as const,
      operations: [{ type: 'remove_element' as const, elementId }],
    };
    const results = await Promise.all(
      removalFirst
        ? [
            execute(data.target.id, remove, 1),
            execute(data.target.id, bind, before!.snapshotVersion),
          ]
        : [
            execute(data.target.id, bind, before!.snapshotVersion),
            execute(data.target.id, remove, 1),
          ]
    );
    assert.equal(
      results.filter((result) => result.ok).length,
      1,
      JSON.stringify(results)
    );
    const after = await loadProjectWithLatestSnapshot({
      projectId: data.target.id,
    });
    const organization = await getOrganization(data.target.id);
    const binding =
      after!.snapshot.organization!.templateInstances[instanceId].slotBindings[
        data.preview.definition.slots[0].id
      ];
    if (binding) {
      assert.equal(organization.document.elements[elementId].deletedAt, null);
      assert.ok(
        Object.values(after!.snapshot.organization!.elementBindings).some(
          (value) => value.elementId === elementId
        )
      );
    } else assert.ok(organization.document.elements[elementId].deletedAt);
    assert.equal(modelCalls, 0);
  });
