import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { z } from 'zod';

import { persistBeatDesignCommand } from '@/core/commands/persist';
import {
  canvasOperationSchema,
  editorOperationSchema,
} from '@/core/commands/schema';
import { applyEditorOperations } from '@/core/commands/editor-commands';
import { createTimelineDocument } from '@/core/editor/timeline-document';
import { listGenerationModelDescriptors } from '@/core/generation-providers';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';

test('MCP tool catalog contains exactly 38 uniquely registered tools', () => {
  const source =
    readFileSync(new URL('./server.ts', import.meta.url), 'utf8') +
    readFileSync(new URL('./organization-tools.ts', import.meta.url), 'utf8');
  const registered = [
    ...source.matchAll(/server\.registerTool\(\s*'([^']+)'/g),
  ].map((match) => match[1]);
  assert.equal(BEATDESIGN_MCP_TOOL_NAMES.length, 38);
  assert.equal(new Set(registered).size, 38);
  assert.deepEqual(registered.sort(), [...BEATDESIGN_MCP_TOOL_NAMES].sort());
});

test('timeline edits invalidate an older render before MCP re-renders', () => {
  const source = createTimelineDocument({
    projectId: 'project-render-stale',
    name: 'Render stale guard',
  });
  const rendered = applyEditorOperations(source, [
    {
      type: 'set_render',
      assetId: 'render-old',
      publicUrl: '/assets/render-old.mp4',
    },
  ]).document;
  assert.equal(rendered.lastRenderAssetId, 'render-old');

  const edited = applyEditorOperations(rendered, [
    { type: 'set_caption_style', preset: 'bold' },
  ]).document;
  assert.equal(edited.lastRenderAssetId, null);
  assert.equal(edited.lastRenderUrl, null);
});

test('project targeting accepts an explicit workspace handoff destination', () => {
  const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
  const targetRegistration = source.match(
    /'bdesign_project_target',[\s\S]*?server\.registerTool\(\s*'bdesign_project_open'/
  )?.[0];

  assert.ok(targetRegistration);
  assert.match(
    targetRegistration,
    /view: z\.enum\(\['studio', 'canvas', 'editor', 'assets'\]\)/
  );
  assert.match(targetRegistration, /focusCardId: idSchema\.optional\(\)/);
  assert.match(
    targetRegistration,
    /time: z\.number\(\)\.finite\(\)\.min\(0\)\.optional\(\)/
  );
  assert.match(
    targetRegistration,
    /buildProjectHandoff\(project, \{ view, focusCardId, time \}\)/
  );
});

test('MCP origin cannot replace a timeline document', async () => {
  const result = await persistBeatDesignCommand({
    projectId: 'project-mcp-guard',
    origin: 'mcp',
    commandId: 'cmd-replace',
    idempotencyKey: 'idem-replace',
    command: {
      type: 'editor.replace_document',
      document: createTimelineDocument({
        projectId: 'project-mcp-guard',
        name: 'Blocked',
      }),
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'INVALID_COMMAND');
    assert.match(result.message, /editor\.apply/);
  }
});

test('Canvas and Editor operations expose concrete JSON Schemas to MCP hosts', () => {
  const canvasJson = JSON.stringify(z.toJSONSchema(canvasOperationSchema));
  const editorJson = JSON.stringify(z.toJSONSchema(editorOperationSchema));

  for (const operation of [
    'upsert_card',
    'remove_card',
    'move_card',
    'set_references',
    'upsert_timeline_node',
  ]) {
    assert.match(canvasJson, new RegExp(operation));
  }
  for (const operation of [
    'add_clip',
    'add_overlay',
    'trim_clip',
    'split_clip',
    'move_clip',
    'set_clip_duration',
    'remove_clip',
    'update_audio',
    'update_overlay',
    'replace_overlay_asset',
    'add_take',
    'activate_take',
    'set_render',
    'upsert_caption',
    'import_srt',
    'set_caption_style',
    'update_caption',
  ]) {
    assert.match(editorJson, new RegExp(operation));
  }
  assert.match(canvasJson, /modelId/);
  assert.match(canvasJson, /referenceCardIds/);
  assert.match(editorJson, /rightClipId/);
  assert.match(editorJson, /image/);
  assert.equal(
    editorOperationSchema.safeParse({
      type: 'add_clip',
      clipId: 'caption-1',
      assetId: 'caption-1',
      name: 'Caption',
      sourceType: 'caption',
      sourceDuration: 1,
    }).success,
    false
  );
});

test('Canvas upsert accepts a minimal explicit generation card', () => {
  const operation = canvasOperationSchema.parse({
    type: 'upsert_card',
    card: {
      id: 'generation-1',
      kind: 'generation',
      type: 'video',
      name: 'Continue shot',
      modelId: 'seedance-2',
      prompt: 'Continue the shot',
    },
  });
  assert.equal(operation.type, 'upsert_card');
  assert.equal(operation.card.status, 'idle');
  assert.equal(operation.card.duration, '5s');
});

test('Canvas get cards can be applied back through upsert_card', () => {
  const operation = canvasOperationSchema.parse({
    type: 'upsert_card',
    card: {
      id: 'shape:legacy',
      kind: 'asset',
      type: 'video',
      name: '  clip  ',
      duration: '5',
      aspectRatio: 'not-a-ratio',
      extraField: 'drop-me',
      url: '/api/app/projects/p/assets/a',
      assetId: 'asset-1',
    },
  });
  assert.equal(operation.type, 'upsert_card');
  assert.equal(operation.card.name, 'clip');
  assert.equal(operation.card.duration, '5s');
  assert.equal(operation.card.aspectRatio, '1:1');
  assert.equal(operation.card.assetId, 'asset-1');
});

test('model discovery used by MCP returns a live catalog', () => {
  const models = listGenerationModelDescriptors();
  assert.ok(models.length >= 10);
  assert.ok(
    models.every((model) => typeof model.id === 'string' && model.id.length > 0)
  );
});

test('organization MCP round trip persists folders, de-duplicates Assets and creates a blocked template without provider calls', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve, dirname } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'beatdesign-org-mcp-'));
  process.env.BEATDESIGN_DATA_DIR = directory;
  execFileSync(
    process.execPath,
    ['node_modules/drizzle-kit/bin.cjs', 'push', '--force'],
    { env: process.env, stdio: 'pipe', windowsHide: true }
  );
  const { createProject, loadProjectWithLatestSnapshot } =
    await import('@/core/projects/projects');
  const { recordUserAsset, linkProjectAsset } =
    await import('@/core/workspace-lib/assets/user-assets');
  const { getDb } = await import('@/core/workspace-lib/db-adapter');
  const { getActiveGenerationProvider } =
    await import('@/core/generation-providers/registry');
  const { startBeatDesignMcpHttpServer } = await import('./http-server');
  const { generationHistory, generationUploadIntent } =
    await import('@/config/db/schema');
  const provider = getActiveGenerationProvider();
  const originalConfigured = provider.assertConfigured;
  const originalAdapter = provider.createAdapter;
  let providerCalls = 0;
  provider.assertConfigured = async () => {
    providerCalls++;
    throw new Error('Organization must stay local');
  };
  provider.createAdapter = () => {
    providerCalls++;
    throw new Error('Organization must not create adapters');
  };
  const server = await startBeatDesignMcpHttpServer({
    host: '127.0.0.1',
    port: 0,
    token: 'test-organization',
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  let rpcId = 0;
  async function call(name: string, args: Record<string, unknown>) {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-organization',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++rpcId,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    const text = await response.text();
    const body = JSON.parse(
      text.startsWith('{')
        ? text
        : text
            .split('\n')
            .find((line) => line.startsWith('data: '))!
            .slice(6)
    );
    assert.equal(body.error, undefined, JSON.stringify(body));
    return body.result;
  }
  function result(value: any) {
    assert.notEqual(value.isError, true, JSON.stringify(value));
    return value.structuredContent.result;
  }
  try {
    const project = await createProject({ name: 'MCP organization isolation' });
    const assetId = await recordUserAsset({
      id: 'org-reference',
      type: 'image',
      source: 'upload',
      bucket: 'fixture',
      objectKey: 'org-reference.png',
      publicUrl: '/fixture.png',
      filename: 'Reference.png',
    });
    await linkProjectAsset({ projectId: project.id, assetId, role: 'upload' });
    await linkProjectAsset({
      projectId: project.id,
      assetId,
      role: 'reference',
    });
    const initial = result(
      await call('bdesign_organization_get', { projectId: project.id })
    );
    assert.equal(initial.revision, 0);
    const operation = {
      type: 'create_folder',
      folderId: 'characters',
      name: 'Characters',
      parentId: null,
    };
    const saved = result(
      await call('bdesign_organization_apply', {
        projectId: project.id,
        expectedRevision: 0,
        commandId: 'folder-create',
        idempotencyKey: 'folder-create',
        operations: [
          operation,
          {
            type: 'assign_assets',
            assetIds: [assetId],
            folderId: 'characters',
          },
        ],
      })
    );
    assert.equal(saved.ok, true, JSON.stringify(saved));
    const same = result(
      await call('bdesign_organization_apply', {
        projectId: project.id,
        expectedRevision: 0,
        commandId: 'folder-create',
        idempotencyKey: 'folder-create',
        operations: [
          operation,
          {
            type: 'assign_assets',
            assetIds: [assetId],
            folderId: 'characters',
          },
        ],
      })
    );
    assert.deepEqual(same, saved);
    const page = result(
      await call('bdesign_asset_query', {
        projectId: project.id,
        scope: 'current',
        folderId: 'characters',
      })
    );
    assert.equal(page.assets.length, 1);
    assert.equal(page.assets[0].id, assetId);
    assert.equal(
      result(await call('bdesign_asset_list', { projectId: project.id }))
        .length,
      1
    );
    const seeded = result(
      await call('bdesign_canvas_apply', {
        projectId: project.id,
        expectedRevision: 1,
        commandId: 'seed-canvas',
        idempotencyKey: 'seed-canvas',
        operations: [
          {
            type: 'upsert_card',
            card: {
              id: 'reference',
              kind: 'asset',
              type: 'image',
              name: 'Reference',
              assetId,
            },
            frame: { x: 0, y: 0, w: 320, h: 180 },
          },
          {
            type: 'upsert_card',
            card: {
              id: 'generation',
              kind: 'generation',
              type: 'image',
              name: 'Candidate',
              modelId: 'gpt-image-2.5-flare',
              prompt: 'Local template fixture',
              referenceCardIds: ['reference'],
            },
            frame: { x: 0, y: 0, w: 320, h: 180 },
          },
        ],
      })
    );
    assert.equal(seeded.ok, true, JSON.stringify(seeded));
    const laidOut = result(
      await call('bdesign_canvas_apply', {
        projectId: project.id,
        expectedRevision: seeded.revision,
        commandId: 'layout-shared',
        idempotencyKey: 'layout-shared',
        operations: [
          {
            type: 'create_group',
            groupId: 'layout-group',
            name: 'Layout',
            role: 'shot',
            memberCardIds: ['reference', 'generation'],
            summaryFrame: { x: 0, y: 0, w: 340, h: 210 },
            expandedFrame: { x: 0, y: 0, w: 1000, h: 1000 },
          },
          { type: 'layout_group', groupId: 'layout-group', mode: 'row' },
          { type: 'fit_group', groupId: 'layout-group' },
          { type: 'arrange_groups', groupIds: ['layout-group'], mode: 'tidy' },
        ],
      })
    );
    assert.equal(laidOut.ok, true, JSON.stringify(laidOut));
    const layoutSnapshot = (await loadProjectWithLatestSnapshot({
      projectId: project.id,
    }))!;
    assert.ok(
      layoutSnapshot.snapshot.frames.generation.x >
        layoutSnapshot.snapshot.frames.reference.x + 320
    );
    assert.ok(
      layoutSnapshot.snapshot.organization!.groups['layout-group'].expandedFrame
        .h < 1000
    );
    const missingEnvelope = await call('bdesign_canvas_apply', {
      projectId: project.id,
      operations: [
        {
          type: 'create_group',
          groupId: 'blocked',
          name: 'Needs stable envelope',
          role: 'shot',
          memberCardIds: ['generation'],
          summaryFrame: { x: 0, y: 0, w: 300, h: 200 },
          expandedFrame: { x: 0, y: 0, w: 600, h: 400 },
        },
      ],
    });
    assert.equal(missingEnvelope.isError, true);
    const preview = result(
      await call('bdesign_workflow_template_preview', {
        projectId: project.id,
        preview: { selectedCardIds: ['generation'] },
      })
    );
    const captured = result(
      await call('bdesign_workflow_template_apply', {
        projectId: project.id,
        expectedRevision: 0,
        commandId: 'capture',
        idempotencyKey: 'capture',
        command: {
          type: 'workflow.template.capture',
          templateId: 'template',
          name: 'Local candidate',
          selectedCardIds: ['generation'],
          sourceCanvasRevision: preview.sourceCanvasRevision,
          definitionDigest: preview.definitionDigest,
        },
      })
    );
    assert.equal(captured.ok, true, JSON.stringify(captured));
    const before = (await loadProjectWithLatestSnapshot({
      projectId: project.id,
    }))!;
    const instantiated = result(
      await call('bdesign_workflow_template_apply', {
        projectId: project.id,
        expectedRevision: before.snapshotVersion,
        commandId: 'instantiate',
        idempotencyKey: 'instantiate',
        command: {
          type: 'workflow.template.instantiate',
          templateId: 'template',
          templateRevision: 1,
          instanceId: 'draft',
          bindings: {},
          placement: { x: 500, y: 300 },
        },
      })
    );
    assert.equal(instantiated.ok, true, JSON.stringify(instantiated));
    assert.ok(instantiated.data.blockers.length > 0);
    assert.equal(
      result(await call('bdesign_workflow_template_list', {})).length,
      1
    );
    const usage = result(
      await call('bdesign_timeline_usage', { projectId: project.id })
    );
    assert.equal(usage.timelineRevision, null);
    assert.deepEqual(usage.clips, []);
    assert.equal(providerCalls, 0);
    assert.equal(
      (await (await getDb()).select().from(generationHistory)).length,
      0
    );
    assert.equal(
      (await (await getDb()).select().from(generationUploadIntent)).length,
      0
    );
  } finally {
    provider.assertConfigured = originalConfigured;
    provider.createAdapter = originalAdapter;
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done()))
    );
    (await getDb()).$client.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
});
