import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { z } from 'zod';

import { persistBeatDesignCommand } from '@/core/commands/persist';
import {
  canvasOperationSchema,
  editorOperationSchema,
} from '@/core/commands/schema';
import { createTimelineDocument } from '@/core/editor/timeline-document';
import { listGenerationModelDescriptors } from '@/core/generation-providers';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';

test('MCP tool catalog is exactly 26 named tools', () => {
  const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
  const registered = [...source.matchAll(/server\.registerTool\(\s*'([^']+)'/g)].map(
    (match) => match[1]
  );
  assert.equal(BEATDESIGN_MCP_TOOL_NAMES.length, 26);
  assert.deepEqual(registered, [...BEATDESIGN_MCP_TOOL_NAMES]);
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
    'add_take',
    'activate_take',
    'set_render',
    'upsert_caption',
    'import_srt',
    'set_caption_style',
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
  assert.ok(models.every((model) => typeof model.id === 'string' && model.id.length > 0));
});
