import {
  activateTimelineTake,
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
  type TimelineAudioRole,
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
      type: 'add_take';
      clipId: string;
      take: Omit<TimelineTake, 'id' | 'createdAt'> & {
        id?: string;
        createdAt?: string;
      };
    }
  | { type: 'activate_take'; clipId: string; takeId: string | null }
  | { type: 'set_render'; assetId: string; publicUrl: string };

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
    } else {
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
