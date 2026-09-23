import { applyEditorOperations, type EditorOperation } from '@/core/commands/editor-commands';
import type { BeatDesignCommand } from '@/core/commands/executor';
import type { TimelineDocument } from './timeline-document';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function buildTimelineEditCommand(base: TimelineDocument | null, next: TimelineDocument): BeatDesignCommand {
  const fallback: BeatDesignCommand = { type: 'editor.replace_document', document: next };
  if (!base) return fallback;
  const before = new Map(base.tracks.flatMap((track) => track.clips).map((clip) => [clip.id, clip]));
  const after = new Map(next.tracks.flatMap((track) => track.clips).map((clip) => [clip.id, clip]));
  const operations: EditorOperation[] = [];
  for (const id of before.keys()) {
    if (!after.has(id)) operations.push({ type: 'remove_clip', clipId: id, ripple: false });
  }
  for (const [id, clip] of after) {
    const previous = before.get(id);
    if (!previous) return fallback;
    if (clip.sourceType === 'caption') {
      if (clip.text !== previous.text || clip.startTime !== previous.startTime || clip.duration !== previous.duration) {
        operations.push({ type: 'upsert_caption', clipId: id, text: clip.text ?? '', startTime: clip.startTime, duration: clip.duration });
      }
    } else {
      if (clip.inPoint !== previous.inPoint || clip.outPoint !== previous.outPoint) {
        operations.push({ type: 'trim_clip', clipId: id, inPoint: clip.inPoint, outPoint: clip.outPoint });
      }
      if (clip.duration !== previous.duration && clip.sourceType === 'image') {
        operations.push({ type: 'set_clip_duration', clipId: id, duration: clip.duration });
      }
      if (clip.startTime !== previous.startTime) {
        operations.push({ type: 'move_clip', clipId: id, startTime: clip.startTime });
      }
      if (clip.overlay && !equal(clip.overlay, previous.overlay)) {
        operations.push({ type: 'update_overlay', clipId: id, patch: clip.overlay });
      }
    }
  }
  if (!operations.length) return fallback;
  // Only choose incremental persistence when the shared kernel reproduces the
  // exact edit. Undo, imports, and unsupported changes retain the UI exception.
  try {
    const applied = applyEditorOperations(base, operations).document;
    const { updatedAt: _a, ...actual } = applied;
    const { updatedAt: _b, ...expected } = next;
    return equal(actual, expected) ? { type: 'editor.apply', operations } : fallback;
  } catch {
    return fallback;
  }
}
