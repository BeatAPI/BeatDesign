/**
 * BeatDesign's compact timeline contract is derived from OpenReel's MIT-licensed
 * Timeline / Track / Clip model. It deliberately keeps only the fields needed by
 * the local-first editing workflow so the host app owns persistence and UI.
 *
 * OpenReel source pin: 5f3c85e5fc223c86060bf4b12e1b4dec58e9b8a9
 * Copyright (c) 2024-2026 Augustus Otu and Contributors
 */

import { z } from 'zod';

export const TIMELINE_SCHEMA_VERSION = 3 as const;

export type TimelineTrackKind = 'video' | 'audio' | 'caption';
export type TimelineAudioRole = 'music' | 'voice' | 'sfx' | 'source';
export type CaptionStylePreset = 'classic' | 'bold' | 'boxed' | 'minimal';

export type TimelineTake = {
  id: string;
  assetId: string;
  sourceUrl: string;
  name: string;
  sourceDuration: number;
  sourceGenerationId: string | null;
  prompt: string;
  createdAt: string;
};

export type TimelineClip = {
  id: string;
  assetId: string;
  sourceUrl: string;
  trackId: string;
  name: string;
  sourceType: 'image' | 'video' | 'audio' | 'caption';
  startTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  sourceDuration: number;
  volume: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  text?: string;
  audioRole?: TimelineAudioRole;
  takes: TimelineTake[];
  activeTakeId: string | null;
};

export type TimelineTrack = {
  id: string;
  kind: TimelineTrackKind;
  name: string;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  clips: TimelineClip[];
};

export type TimelineDocument = {
  schemaVersion: typeof TIMELINE_SCHEMA_VERSION;
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  lastRenderAssetId: string | null;
  lastRenderUrl: string | null;
  captionStyle: CaptionStylePreset;
  tracks: TimelineTrack[];
};

export const MAX_TIMELINE_DOCUMENT_BYTES = 2 * 1024 * 1024;

export class TimelineDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimelineDocumentValidationError';
  }
}

const timelineClipSchema = z.object({
  id: z.string().min(1).max(160),
  assetId: z.string().min(1).max(160),
  sourceUrl: z.string().max(4096),
  trackId: z.string().min(1).max(160),
  name: z.string().min(1).max(240),
  sourceType: z.enum(['image', 'video', 'audio', 'caption']),
  startTime: z.number().finite().min(0).max(86_400),
  duration: z.number().finite().positive().max(86_400),
  inPoint: z.number().finite().min(0).max(86_400),
  outPoint: z.number().finite().positive().max(86_400),
  sourceDuration: z.number().finite().positive().max(86_400),
  volume: z.number().finite().min(0).max(4),
  muted: z.boolean(),
  fadeIn: z.number().finite().min(0).max(86_400).default(0),
  fadeOut: z.number().finite().min(0).max(86_400).default(0),
  text: z.string().max(4_000).default(''),
  audioRole: z.enum(['music', 'voice', 'sfx', 'source']).optional(),
  takes: z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        assetId: z.string().min(1).max(160),
        sourceUrl: z.string().max(4096),
        name: z.string().min(1).max(240),
        sourceDuration: z.number().finite().positive().max(86_400),
        sourceGenerationId: z.string().min(1).max(200).nullable(),
        prompt: z.string().max(20_000),
        createdAt: z.string().min(1).max(80),
      })
    )
    .max(100)
    .default([]),
  activeTakeId: z.string().min(1).max(160).nullable().default(null),
});

const timelineTrackSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.enum(['video', 'audio', 'caption']),
  name: z.string().min(1).max(120),
  locked: z.boolean(),
  hidden: z.boolean(),
  muted: z.boolean(),
  clips: z.array(timelineClipSchema).max(1_000),
});

const timelineDocumentSchema = z.object({
  schemaVersion: z.literal(TIMELINE_SCHEMA_VERSION),
  id: z.string().min(1).max(160),
  projectId: z.string().min(1).max(160),
  name: z.string().min(1).max(240),
  createdAt: z.string().min(1).max(80),
  updatedAt: z.string().min(1).max(80),
  duration: z.number().finite().min(0).max(86_400),
  lastRenderAssetId: z.string().min(1).max(160).nullable().default(null),
  lastRenderUrl: z.string().min(1).max(4096).nullable().default(null),
  captionStyle: z
    .enum(['classic', 'bold', 'boxed', 'minimal'])
    .default('classic'),
  tracks: z.array(timelineTrackSchema).min(1).max(64),
});

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const roundTime = (value: number) => Math.round(value * 1000) / 1000;

export function calculateTimelineDuration(tracks: readonly TimelineTrack[]) {
  return roundTime(
    tracks.reduce(
      (timelineEnd, track) =>
        track.clips.reduce(
          (trackEnd, clip) =>
            Math.max(trackEnd, clip.startTime + clip.duration),
          timelineEnd
        ),
      0
    )
  );
}

export function createTimelineDocument({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}): TimelineDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    id: createId('timeline'),
    projectId,
    name,
    createdAt: now,
    updatedAt: now,
    duration: 0,
    lastRenderAssetId: null,
    lastRenderUrl: null,
    captionStyle: 'classic',
    tracks: [
      {
        id: createId('video-track'),
        kind: 'video',
        name: 'Visual 1',
        locked: false,
        hidden: false,
        muted: false,
        clips: [],
      },
      {
        id: createId('audio-track'),
        kind: 'audio',
        name: 'Audio 1',
        locked: false,
        hidden: false,
        muted: false,
        clips: [],
      },
      {
        id: createId('caption-track'),
        kind: 'caption',
        name: 'Captions',
        locked: false,
        hidden: false,
        muted: false,
        clips: [],
      },
    ],
  };
}

function withUpdatedTracks(
  document: TimelineDocument,
  tracks: TimelineTrack[]
): TimelineDocument {
  return {
    ...document,
    tracks,
    duration: calculateTimelineDuration(tracks),
    updatedAt: new Date().toISOString(),
  };
}

export function addSourceClip(
  document: TimelineDocument,
  source: {
    assetId: string;
    sourceUrl?: string;
    name: string;
    sourceType: 'image' | 'video' | 'audio';
    sourceDuration: number;
    startTime?: number;
    audioRole?: TimelineAudioRole;
    clipId?: string;
  }
) {
  const sourceDuration = roundTime(finiteNonNegative(source.sourceDuration));
  if (sourceDuration <= 0) return document;

  const targetKind = source.sourceType === 'audio' ? 'audio' : 'video';
  const existingTrack = document.tracks.find((track) => track.kind === targetKind);
  if (!existingTrack) return document;
  if (
    source.clipId &&
    existingTrack.clips.some((clip) => clip.id === source.clipId)
  ) {
    return document;
  }

  const startTime = roundTime(
    finiteNonNegative(
      source.startTime ??
        existingTrack.clips.reduce(
          (end, candidate) =>
            Math.max(end, candidate.startTime + candidate.duration),
          0
        )
    )
  );
  const clip: TimelineClip = {
    id: source.clipId?.trim() || createId('clip'),
    assetId: source.assetId,
    sourceUrl: source.sourceUrl ?? '',
    trackId: existingTrack.id,
    name: source.name,
    sourceType: source.sourceType,
    startTime,
    duration: sourceDuration,
    inPoint: 0,
    outPoint: sourceDuration,
    sourceDuration,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    text: '',
    audioRole: source.audioRole,
    takes: [],
    activeTakeId: null,
  };

  return withUpdatedTracks(
    document,
    document.tracks.map((track) =>
      track.id === existingTrack.id
        ? { ...track, clips: [...track.clips, clip] }
        : track
    )
  );
}

export function normalizeTimelineDocument(
  value: unknown,
  expectedProjectId?: string
): TimelineDocument {
  const version =
    value && typeof value === 'object'
      ? (value as { schemaVersion?: unknown }).schemaVersion
      : null;
  const legacyDocument = value as Record<string, unknown>;
  const migrated =
    version === 1 || version === 2
      ? {
          ...legacyDocument,
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          lastRenderAssetId:
            version === 1 ? null : (legacyDocument.lastRenderAssetId ?? null),
          lastRenderUrl:
            version === 1 ? null : (legacyDocument.lastRenderUrl ?? null),
          tracks: Array.isArray((value as { tracks?: unknown }).tracks)
            ? ((value as { tracks: unknown[] }).tracks).map((track) =>
                track && typeof track === 'object'
                  ? {
                      ...(track as Record<string, unknown>),
                      name:
                        (track as { name?: unknown }).name === 'Video 1'
                          ? 'Visual 1'
                          : (track as { name?: unknown }).name,
                      clips: Array.isArray(
                        (track as { clips?: unknown }).clips
                      )
                        ? ((track as { clips: unknown[] }).clips).map((clip) =>
                            clip && typeof clip === 'object'
                              ? {
                                  ...(clip as Record<string, unknown>),
                                  takes:
                                    version === 1
                                      ? []
                                      : ((clip as { takes?: unknown }).takes ?? []),
                                  activeTakeId:
                                    version === 1
                                      ? null
                                      : ((clip as { activeTakeId?: unknown })
                                          .activeTakeId ?? null),
                                }
                              : clip
                          )
                        : [],
                    }
                  : track
              )
            : [],
        }
      : value;
  const parsedResult = timelineDocumentSchema.safeParse(migrated);
  if (!parsedResult.success) {
    throw new TimelineDocumentValidationError(
      parsedResult.error.issues[0]?.message ?? 'Timeline document is invalid.'
    );
  }
  const parsed = parsedResult.data;
  if (expectedProjectId && parsed.projectId !== expectedProjectId) {
    throw new TimelineDocumentValidationError(
      'Timeline project id does not match the route project.'
    );
  }
  for (const track of parsed.tracks) {
    for (const clip of track.clips) {
      if (clip.trackId !== track.id) {
        throw new TimelineDocumentValidationError(
          'Timeline clip points to a different track.'
        );
      }
      if (
        clip.sourceType !== 'caption' &&
        (!clip.sourceUrl ||
          clip.outPoint <= clip.inPoint ||
          clip.outPoint > clip.sourceDuration)
      ) {
        throw new TimelineDocumentValidationError(
          'Timeline clip has an invalid source range.'
        );
      }
      if (
        clip.sourceType === 'caption' &&
        (clip.outPoint <= clip.inPoint || clip.outPoint > clip.sourceDuration)
      ) {
        throw new TimelineDocumentValidationError(
          'Timeline clip has an invalid source range.'
        );
      }
      if (
        clip.activeTakeId &&
        !clip.takes.some((take) => take.id === clip.activeTakeId)
      ) {
        throw new TimelineDocumentValidationError(
          'Timeline clip points to a missing take.'
        );
      }
    }
  }
  const tracks = parsed.tracks.some((track) => track.kind === 'caption')
    ? parsed.tracks
    : [
        ...parsed.tracks,
        {
          id: createId('caption-track'),
          kind: 'caption' as const,
          name: 'Captions',
          locked: false,
          hidden: false,
          muted: false,
          clips: [],
        },
      ];
  return {
    ...parsed,
    tracks,
    duration: calculateTimelineDuration(tracks),
  };
}

export function getTimelineClipSource(clip: TimelineClip) {
  const take = clip.activeTakeId
    ? clip.takes.find((candidate) => candidate.id === clip.activeTakeId)
    : null;
  return take
    ? {
        assetId: take.assetId,
        sourceUrl: take.sourceUrl,
        name: take.name,
        sourceDuration: take.sourceDuration,
        inPoint: 0,
        outPoint: Math.min(take.sourceDuration, clip.duration),
        take,
      }
    : {
        assetId: clip.assetId,
        sourceUrl: clip.sourceUrl,
        name: clip.name,
        sourceDuration: clip.sourceDuration,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        take: null,
      };
}

export function addTimelineTake(
  document: TimelineDocument,
  clipId: string,
  input: Omit<TimelineTake, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }
) {
  const clip = findTimelineClip(document, clipId);
  if (
    !clip ||
    clip.sourceType !== 'video' ||
    input.sourceDuration < clip.duration - 0.05
  ) {
    return document;
  }
  const take: TimelineTake = {
    ...input,
    id: input.id ?? createId('take'),
    createdAt: input.createdAt ?? new Date().toISOString(),
    sourceDuration: roundTime(input.sourceDuration),
  };
  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((candidate) =>
        candidate.id === clipId
          ? {
              ...candidate,
              takes: [
                ...candidate.takes.filter((item) => item.id !== take.id),
                take,
              ],
            }
          : candidate
      ),
    }))
  );
}

export function activateTimelineTake(
  document: TimelineDocument,
  clipId: string,
  takeId: string | null
) {
  const clip = findTimelineClip(document, clipId);
  const take = takeId
    ? clip?.takes.find((candidate) => candidate.id === takeId)
    : null;
  if (
    !clip ||
    (takeId && !take) ||
    (take && take.sourceDuration < clip.duration - 0.05)
  ) {
    return document;
  }
  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((candidate) =>
        candidate.id === clipId
          ? { ...candidate, activeTakeId: takeId }
          : candidate
      ),
    }))
  );
}

export function setTimelineRender(
  document: TimelineDocument,
  asset: { id: string; publicUrl: string }
): TimelineDocument {
  return {
    ...document,
    lastRenderAssetId: asset.id,
    lastRenderUrl: asset.publicUrl,
    updatedAt: new Date().toISOString(),
  };
}

export function findTimelineClip(
  document: TimelineDocument,
  clipId: string
) {
  return document.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === clipId);
}

export function trimTimelineClip(
  document: TimelineDocument,
  clipId: string,
  nextInPoint: number,
  nextOutPoint: number
) {
  const clip = findTimelineClip(document, clipId);
  if (!clip) return document;

  const inPoint = roundTime(
    Math.min(clip.sourceDuration, finiteNonNegative(nextInPoint))
  );
  const outPoint = roundTime(
    Math.min(clip.sourceDuration, finiteNonNegative(nextOutPoint))
  );
  if (outPoint - inPoint < 0.04) return document;

  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((candidate) =>
        candidate.id === clipId
          ? {
              ...candidate,
              inPoint,
              outPoint,
              duration: roundTime(outPoint - inPoint),
            }
          : candidate
      ),
    }))
  );
}

export function resizeTimelineClip(
  document: TimelineDocument,
  clipId: string,
  nextDuration: number
) {
  const clip = findTimelineClip(document, clipId);
  if (!clip || clip.sourceType !== 'image') return document;
  const duration = roundTime(finiteNonNegative(nextDuration));
  if (duration < 0.04) return document;

  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((candidate) =>
        candidate.id === clipId
          ? {
              ...candidate,
              duration,
              inPoint: 0,
              outPoint: duration,
              sourceDuration: duration,
            }
          : candidate
      ),
    }))
  );
}

export function splitTimelineClip(
  document: TimelineDocument,
  clipId: string,
  sourceTime: number,
  rightClipId?: string
) {
  const clip = findTimelineClip(document, clipId);
  if (!clip || clip.activeTakeId) return document;
  if (
    rightClipId &&
    document.tracks.some((track) =>
      track.clips.some((candidate) => candidate.id === rightClipId)
    )
  ) {
    return document;
  }

  const splitPoint = roundTime(sourceTime);
  if (splitPoint - clip.inPoint < 0.04 || clip.outPoint - splitPoint < 0.04) {
    return document;
  }

  const left: TimelineClip = {
    ...clip,
    outPoint: splitPoint,
    duration: roundTime(splitPoint - clip.inPoint),
  };
  const right: TimelineClip = {
    ...clip,
    id: rightClipId?.trim() || createId('clip'),
    startTime: roundTime(clip.startTime + left.duration),
    inPoint: splitPoint,
    duration: roundTime(clip.outPoint - splitPoint),
  };

  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.flatMap((candidate) =>
        candidate.id === clipId ? [left, right] : [candidate]
      ),
    }))
  );
}

export function removeTimelineClip(
  document: TimelineDocument,
  clipId: string
) {
  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
    }))
  );
}

export function moveTimelineClip(
  document: TimelineDocument,
  clipId: string,
  nextStartTime: number
) {
  const clip = findTimelineClip(document, clipId);
  if (!clip) return document;
  const startTime = roundTime(finiteNonNegative(nextStartTime));
  const endTime = startTime + clip.duration;
  const track = document.tracks.find((candidate) => candidate.id === clip.trackId);
  if (
    track?.clips.some(
      (candidate) =>
        candidate.id !== clipId &&
        startTime < candidate.startTime + candidate.duration &&
        endTime > candidate.startTime
    )
  ) {
    return document;
  }
  return withUpdatedTracks(
    document,
    document.tracks.map((candidate) => ({
      ...candidate,
      clips: candidate.clips.map((item) =>
        item.id === clipId ? { ...item, startTime } : item
      ),
    }))
  );
}

export function rippleDeleteTimelineClip(
  document: TimelineDocument,
  clipId: string
) {
  const clip = findTimelineClip(document, clipId);
  if (!clip) return document;
  return withUpdatedTracks(
    document,
    document.tracks.map((track) =>
      track.id !== clip.trackId
        ? track
        : {
            ...track,
            clips: track.clips
              .filter((candidate) => candidate.id !== clipId)
              .map((candidate) =>
                candidate.startTime > clip.startTime
                  ? {
                      ...candidate,
                      startTime: roundTime(
                        Math.max(clip.startTime, candidate.startTime - clip.duration)
                      ),
                    }
                  : candidate
              ),
          }
    )
  );
}

export function updateTimelineAudioClip(
  document: TimelineDocument,
  clipId: string,
  patch: Partial<Pick<TimelineClip, 'volume' | 'muted' | 'fadeIn' | 'fadeOut'>>
) {
  const clip = findTimelineClip(document, clipId);
  if (!clip || clip.sourceType !== 'audio') return document;
  return withUpdatedTracks(
    document,
    document.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((candidate) =>
        candidate.id === clipId
          ? {
              ...candidate,
              volume:
                typeof patch.volume === 'number'
                  ? Math.max(0, Math.min(4, patch.volume))
                  : candidate.volume,
              muted: patch.muted ?? candidate.muted,
              fadeIn:
                typeof patch.fadeIn === 'number'
                  ? Math.max(0, Math.min(candidate.duration, patch.fadeIn))
                  : candidate.fadeIn,
              fadeOut:
                typeof patch.fadeOut === 'number'
                  ? Math.max(0, Math.min(candidate.duration, patch.fadeOut))
                  : candidate.fadeOut,
            }
          : candidate
      ),
    }))
  );
}
