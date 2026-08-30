import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasAssetCard } from '@/core/beatcanvas/canvas-types';
import { createTimelineDocument } from '@/core/editor/timeline-document';
import { validateLocalAssetImportCandidate } from '@/core/projects/import-local-asset';
import { createEmptyProjectSnapshot } from '@/core/projects/project-snapshot';
import {
  applyCanvasOperations,
  applyEditorOperations,
  uiCommandRequestSchema,
  createCommandFailure,
  createCommandId,
  executeBeatDesignCommand,
  normalizeAssetFirstGenerationRequest,
} from './index';
import { validateExternalCommandAssetReferences } from './persist';

test('revision conflict failures return the current revision for one-step retries', () => {
  assert.deepEqual(
    createCommandFailure({
      commandId: 'command-1',
      projectId: 'project-1',
      origin: 'mcp',
      code: 'REVISION_CONFLICT',
      message: 'Project snapshot version conflict',
      revision: 7,
    }),
    {
      ok: false,
      commandId: 'command-1',
      projectId: 'project-1',
      origin: 'mcp',
      changedIds: [],
      warnings: [],
      code: 'REVISION_CONFLICT',
      message: 'Project snapshot version conflict',
      revision: 7,
    }
  );
});

test('command request schema rejects unknown commands and unstable editor ids', () => {
  assert.equal(
    uiCommandRequestSchema.safeParse({
      command: { type: 'editor.erase_everything' },
    }).success,
    false
  );
  assert.equal(
    uiCommandRequestSchema.safeParse({
      command: {
        type: 'editor.apply',
        operations: [
          {
            type: 'add_clip',
            assetId: 'asset-a',
            name: 'A',
            sourceType: 'video',
            sourceDuration: 4,
          },
        ],
      },
    }).success,
    false
  );
  assert.equal(
    uiCommandRequestSchema.safeParse({
      command: {
        type: 'editor.apply',
        operations: [
          {
            type: 'split_clip',
            clipId: 'clip-a',
            sourceTime: 2,
          },
        ],
      },
    }).success,
    false
  );
});

const assetCard: CanvasAssetCard = {
  id: 'asset-card-1',
  assetId: 'asset-1',
  kind: 'asset',
  type: 'video',
  name: 'Scene A',
  url: '/scene-a.mp4',
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: '',
  aspectRatio: '16:9',
  outputQuality: '1080p',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
};

test('external Canvas commands require project assets instead of arbitrary URLs', () => {
  const urlOnlyAssetCommand = {
    type: 'canvas.apply' as const,
    operations: [
      {
        type: 'upsert_card' as const,
        card: { ...assetCard, assetId: null, url: 'https://example.com/a.mp4' },
      },
    ],
  };

  assert.throws(
    () =>
      validateExternalCommandAssetReferences({
        origin: 'mcp',
        command: urlOnlyAssetCommand,
      }),
    /assetId/i
  );
  assert.doesNotThrow(() =>
    validateExternalCommandAssetReferences({
      origin: 'ui',
      command: urlOnlyAssetCommand,
    })
  );
  assert.throws(
    () =>
      validateExternalCommandAssetReferences({
        origin: 'mcp',
        command: {
          type: 'canvas.apply',
          operations: [
            {
              type: 'upsert_timeline_node',
              timelineId: 'timeline-1',
              name: 'Timeline 1',
              durationSec: 4,
              clipCount: 1,
              lastRenderUrl: 'https://example.com/render.mp4',
            },
          ],
        },
      }),
    /lastRenderAssetId/i
  );
});

test('local import validates file size before reading and accepts audio extensions', () => {
  assert.deepEqual(
    validateLocalAssetImportCandidate({ filename: 'music.mp3', size: 1024 }),
    { mediaType: 'audio', mimeType: 'audio/mpeg' }
  );
  assert.throws(
    () =>
      validateLocalAssetImportCandidate({
        filename: 'oversized.mp4',
        size: Number.MAX_SAFE_INTEGER,
      }),
    /size is not supported/i
  );
});

test('generation requests are asset-first and do not accept placement', () => {
  assert.throws(() =>
    normalizeAssetFirstGenerationRequest({
      version: 1,
      projectId: 'project-1',
      mode: 'video',
      modelId: 'model-1',
      prompt: 'Continue the shot',
      references: [{ assetId: 'asset-frame', role: 'first_frame' }],
      parameters: {},
      placement: 'canvas_node',
    })
  );

  const request = normalizeAssetFirstGenerationRequest({
    version: 1,
    projectId: 'project-1',
    mode: 'video',
    modelId: 'model-1',
    prompt: 'Continue the shot',
    references: [{ assetId: 'asset-frame', role: 'first_frame' }],
  });
  assert.equal(request.references[0]?.assetId, 'asset-frame');
});

test('canvas operations update cards and frames atomically', () => {
  const result = applyCanvasOperations(createEmptyProjectSnapshot(), [
    {
      type: 'upsert_card',
      card: assetCard,
      frame: { x: 20, y: 30, w: 320, h: 180 },
    },
    {
      type: 'move_card',
      cardId: assetCard.id,
      frame: { x: 100, y: 120, w: 320, h: 180 },
    },
  ]);
  assert.equal(result.document.cards.length, 1);
  assert.equal(result.document.frames[assetCard.id]?.x, 100);
  assert.deepEqual(result.changedIds, [assetCard.id]);
});

test('editor operations compose multiple clips in one document transaction', () => {
  const timeline = createTimelineDocument({ projectId: 'project-1', name: 'Timeline 1' });
  const result = applyEditorOperations(timeline, [
    {
      type: 'add_clip',
      assetId: 'asset-a',
      sourceUrl: '/a.mp4',
      name: 'A',
      sourceType: 'video',
      sourceDuration: 4,
    },
    {
      type: 'add_clip',
      assetId: 'asset-b',
      sourceUrl: '/b.mp4',
      name: 'B',
      sourceType: 'video',
      sourceDuration: 3,
    },
  ]);
  const clips = result.document.tracks.find((track) => track.kind === 'video')?.clips ?? [];
  assert.equal(clips.length, 2);
  assert.equal(clips[0]?.startTime, 0);
  assert.equal(clips[1]?.startTime, 4);
  assert.equal(result.document.duration, 7);
});

test('timeline node upsert preserves existing canvas references', () => {
  const withVideo = applyCanvasOperations(createEmptyProjectSnapshot(), [
    {
      type: 'upsert_card',
      card: assetCard,
      frame: { x: 0, y: 0, w: 320, h: 180 },
    },
  ]).document;
  const created = applyCanvasOperations(withVideo, [
    {
      type: 'upsert_timeline_node',
      timelineId: 'timeline-1',
      name: 'Timeline 1',
      durationSec: 4,
      clipCount: 1,
      referenceCardIds: [assetCard.id],
    },
  ]);
  const updated = applyCanvasOperations(created.document, [
    {
      type: 'upsert_timeline_node',
      timelineId: 'timeline-1',
      name: 'Timeline 1',
      durationSec: 8,
      clipCount: 2,
      lastRenderAssetId: 'render-1',
      lastRenderUrl: '/render.mp4',
    },
  ]);
  const timelineCard = updated.document.cards.find(
    (card) => card.id === 'timeline:timeline-1'
  );
  assert.deepEqual(timelineCard?.referenceCardIds, [assetCard.id]);
  assert.equal(timelineCard?.lastRenderAssetId, 'render-1');
  assert.equal(timelineCard?.durationSec, 8);
});

test('add_clip with a stable clip id is idempotent', () => {
  const timeline = createTimelineDocument({
    projectId: 'project-1',
    name: 'Timeline 1',
  });
  const first = applyEditorOperations(timeline, [
    {
      type: 'add_clip',
      clipId: 'clip:batch:asset-a:0',
      assetId: 'asset-a',
      sourceUrl: '/a.mp4',
      name: 'A',
      sourceType: 'video',
      sourceDuration: 4,
    },
  ]);
  const retry = applyEditorOperations(first.document, [
    {
      type: 'add_clip',
      clipId: 'clip:batch:asset-a:0',
      assetId: 'asset-a',
      sourceUrl: '/a.mp4',
      name: 'A',
      sourceType: 'video',
      sourceDuration: 4,
    },
  ]);
  const clips =
    retry.document.tracks.find((track) => track.kind === 'video')?.clips ?? [];
  assert.equal(clips.length, 1);
  assert.equal(clips[0]?.id, 'clip:batch:asset-a:0');
});

test('command executor returns a structured result for editor apply', () => {
  const timeline = createTimelineDocument({
    projectId: 'project-1',
    name: 'Timeline 1',
  });
  const result = executeBeatDesignCommand({
    envelope: {
      commandId: createCommandId(),
      projectId: 'project-1',
      origin: 'ui',
      command: {
        type: 'editor.apply',
        operations: [
          {
            type: 'add_clip',
            assetId: 'asset-a',
            sourceUrl: '/a.mp4',
            name: 'A',
            sourceType: 'video',
            sourceDuration: 5,
          },
        ],
      },
    },
    documents: { timeline },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.timeline?.duration, 5);
    assert.equal(result.changedIds.length, 1);
  }
});
