import {
  applySrtToTimeline,
  setCaptionStyle,
  upsertCaptionCue,
} from '@/core/editor/captions';
import {
  activateTimelineTake,
  addOverlayClip,
  addSourceClip,
  addTimelineTake,
  findTimelineClip,
  moveTimelineClip,
  removeTimelineClip,
  resizeTimelineClip,
  rippleDeleteTimelineClip,
  setTimelineRender,
  splitTimelineClip,
  trimTimelineClip,
  updateTimelineAudioClip,
  updateTimelineOverlay,
  type TimelineAudioRole,
  type CaptionStylePreset,
  type TimelineDocument,
  type TimelineTake,
} from '@/core/editor/timeline-document';
import { BeatDesignCommandError } from './contracts';

export type EditorOperation =
  | {
      type: 'add_clip';
      assetId: string;
      sourceUrl: string;
      name: string;
      sourceType: 'image' | 'video' | 'audio';
      sourceDuration: number;
      startTime?: number;
      audioRole?: TimelineAudioRole;
      clipId?: string;
    }
  | {
      type: 'add_overlay';
      clipId?: string;
      assetId: string;
      sourceUrl: string;
      name: string;
      startTime: number;
      duration: number;
      x?: number;
      y?: number;
      width?: number;
      opacity?: number;
      rotation?: number;
      fadeIn?: number;
      fadeOut?: number;
    }
  | { type: 'trim_clip'; clipId: string; inPoint: number; outPoint: number }
  | {
      type: 'split_clip';
      clipId: string;
      sourceTime: number;
      rightClipId?: string;
    }
  | { type: 'move_clip'; clipId: string; startTime: number }
  | { type: 'set_clip_duration'; clipId: string; duration: number }
  | { type: 'remove_clip'; clipId: string; ripple?: boolean }
  | {
      type: 'update_audio';
      clipId: string;
      patch: {
        volume?: number;
        muted?: boolean;
        fadeIn?: number;
        fadeOut?: number;
      };
    }
  | {
      type: 'update_overlay';
      clipId: string;
      patch: {
        x?: number;
        y?: number;
        width?: number;
        opacity?: number;
        rotation?: number;
        fadeIn?: number;
        fadeOut?: number;
      };
    }
  | {
      type: 'add_take';
      clipId: string;
      take: Omit<TimelineTake, 'id' | 'createdAt'> & {
        id?: string;
        createdAt?: string;
      };
    }
  | { type: 'activate_take'; clipId: string; takeId: string | null }
  | { type: 'set_render'; assetId: string; publicUrl: string }
  | {
      type: 'upsert_caption';
      clipId: string;
      text: string;
      startTime: number;
      duration: number;
    }
  | { type: 'import_srt'; srt: string; replace?: boolean }
  | { type: 'set_caption_style'; preset: CaptionStylePreset };

const listClipIds = (document: TimelineDocument) =>
  new Set(document.tracks.flatMap((track) => track.clips.map((clip) => clip.id)));

export function applyEditorOperations(
  source: TimelineDocument,
  operations: readonly EditorOperation[]
) {
  let document = source;
  const changedIds = new Set<string>();

  for (const [index, operation] of operations.entries()) {
    const beforeClipIds = listClipIds(document);
    let next = document;

    if (operation.type === 'add_clip') {
      if (!operation.assetId || !operation.sourceUrl || operation.sourceDuration <= 0) {
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          `Editor operation ${index} has an invalid clip source.`
        );
      }
      next = addSourceClip(document, operation);
      if (next === document && operation.clipId && beforeClipIds.has(operation.clipId)) {
        continue;
      }
    } else if (operation.type === 'add_overlay') {
      if (!operation.assetId || !operation.sourceUrl || operation.duration <= 0) {
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          `Editor operation ${index} has an invalid overlay source.`
        );
      }
      next = addOverlayClip(document, operation);
      if (next === document && operation.clipId && beforeClipIds.has(operation.clipId)) {
        continue;
      }
    } else if (operation.type === 'trim_clip') {
      if (!findTimelineClip(document, operation.clipId)) {
        throw new BeatDesignCommandError('NOT_FOUND', `Clip ${operation.clipId} was not found.`);
      }
      next = trimTimelineClip(
        document,
        operation.clipId,
        operation.inPoint,
        operation.outPoint
      );
    } else if (operation.type === 'split_clip') {
      if (!findTimelineClip(document, operation.clipId)) {
        throw new BeatDesignCommandError('NOT_FOUND', `Clip ${operation.clipId} was not found.`);
      }
      next = splitTimelineClip(
        document,
        operation.clipId,
        operation.sourceTime,
        operation.rightClipId
      );
    } else if (operation.type === 'move_clip') {
      if (!findTimelineClip(document, operation.clipId)) {
        throw new BeatDesignCommandError('NOT_FOUND', `Clip ${operation.clipId} was not found.`);
      }
      next = moveTimelineClip(document, operation.clipId, operation.startTime);
    } else if (operation.type === 'set_clip_duration') {
      const clip = findTimelineClip(document, operation.clipId);
      if (!clip || clip.sourceType !== 'image') {
        throw new BeatDesignCommandError(
          'NOT_FOUND',
          `Image clip ${operation.clipId} was not found.`
        );
      }
      next = resizeTimelineClip(document, operation.clipId, operation.duration);
    } else if (operation.type === 'remove_clip') {
      if (!findTimelineClip(document, operation.clipId)) {
        throw new BeatDesignCommandError('NOT_FOUND', `Clip ${operation.clipId} was not found.`);
      }
      next = operation.ripple
        ? rippleDeleteTimelineClip(document, operation.clipId)
        : removeTimelineClip(document, operation.clipId);
    } else if (operation.type === 'update_audio') {
      const clip = findTimelineClip(document, operation.clipId);
      if (!clip || clip.sourceType !== 'audio') {
        throw new BeatDesignCommandError('NOT_FOUND', `Audio clip ${operation.clipId} was not found.`);
      }
      next = updateTimelineAudioClip(document, operation.clipId, operation.patch);
    } else if (operation.type === 'update_overlay') {
      const clip = findTimelineClip(document, operation.clipId);
      if (!clip?.overlay) {
        throw new BeatDesignCommandError(
          'NOT_FOUND',
          `Overlay clip ${operation.clipId} was not found.`
        );
      }
      next = updateTimelineOverlay(document, operation.clipId, operation.patch);
    } else if (operation.type === 'add_take') {
      if (!findTimelineClip(document, operation.clipId)) {
        throw new BeatDesignCommandError('NOT_FOUND', `Clip ${operation.clipId} was not found.`);
      }
      next = addTimelineTake(document, operation.clipId, operation.take);
    } else if (operation.type === 'activate_take') {
      if (!findTimelineClip(document, operation.clipId)) {
        throw new BeatDesignCommandError('NOT_FOUND', `Clip ${operation.clipId} was not found.`);
      }
      next = activateTimelineTake(document, operation.clipId, operation.takeId);
    } else if (operation.type === 'upsert_caption') {
      const text = operation.text.trim();
      if (!text) {
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          `Editor operation ${index} has empty caption text.`
        );
      }
      next = upsertCaptionCue(document, {
        clipId: operation.clipId,
        text,
        startTime: operation.startTime,
        endTime: operation.startTime + operation.duration,
      });
    } else if (operation.type === 'import_srt') {
      next = applySrtToTimeline(document, operation.srt, operation.replace !== false);
      changedIds.add(next.id);
    } else if (operation.type === 'set_caption_style') {
      next = setCaptionStyle(document, operation.preset);
      changedIds.add(next.id);
    } else if (operation.type === 'set_render') {
      next = setTimelineRender(document, {
        id: operation.assetId,
        publicUrl: operation.publicUrl,
      });
      changedIds.add(document.id);
    }

    if (next === document) {
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        `Editor operation ${index} (${operation.type}) could not be applied.`
      );
    }

    const afterClipIds = listClipIds(next);
    for (const clipId of new Set([...beforeClipIds, ...afterClipIds])) {
      const before = findTimelineClip(document, clipId);
      const after = findTimelineClip(next, clipId);
      if (JSON.stringify(before) !== JSON.stringify(after)) changedIds.add(clipId);
    }
    if ('clipId' in operation && operation.clipId) {
      changedIds.add(operation.clipId);
    }
    document = next;
  }

  return { document, changedIds: [...changedIds] };
}
