import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimelineDocument } from './timeline-document';
import { applyEditorOperations } from '@/core/commands/editor-commands';
import { buildTimelineEditCommand } from './timeline-command';

test('UI trim, move and caption edits compile to incremental kernel operations', () => {
  const base = applyEditorOperations(createTimelineDocument({ projectId: 'project', name: 'Timeline' }), [
    { type: 'add_clip', clipId: 'clip', assetId: 'video', sourceUrl: '/video.mp4', name: 'Video', sourceType: 'video', sourceDuration: 10 },
    { type: 'upsert_caption', clipId: 'caption', text: 'Original', startTime: 0, duration: 2 },
  ]).document;
  for (const operation of [
    { type: 'trim_clip' as const, clipId: 'clip', inPoint: 2, outPoint: 6 },
    { type: 'move_clip' as const, clipId: 'clip', startTime: 3 },
    { type: 'upsert_caption' as const, clipId: 'caption', text: 'Edited', startTime: 1, duration: 3 },
  ]) {
    const next = applyEditorOperations(base, [operation]).document;
    const command = buildTimelineEditCommand(base, next);
    assert.equal(command.type, 'editor.apply', operation.type);
  }
});

test('unsupported document changes retain the explicit UI replacement exception', () => {
  const base = createTimelineDocument({ projectId: 'project', name: 'Timeline' });
  assert.equal(buildTimelineEditCommand(base, { ...base, name: 'Renamed' }).type, 'editor.replace_document');
});
