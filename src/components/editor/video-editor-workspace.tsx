import {
  Download,
  FileVideo2,
  ImageIcon,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Undo2,
  Redo2,
  Volume2,
} from 'lucide-react';
import {
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { uploadLocalProjectAsset } from '@/core/workspace-lib/app/local-project-asset-client';
import { executeProjectCommand } from '@/core/commands/client';
import { createCommandId } from '@/core/commands/contracts';
import {
  applyEditorOperations,
  type EditorOperation,
} from '@/core/commands/editor-commands';
import {
  createTimelineDocument,
  findTimelineClip,
  getTimelineClipSource,
  type TimelineClip,
  type TimelineDocument,
} from '@/core/editor/timeline-document';
import { DEFAULT_IMAGE_CLIP_DURATION } from '@/core/editor/timeline-client';
import {
  downloadBlob,
  exportTimelineMp4,
  exportTrimmedMp4,
  inspectLocalMedia,
  type LocalMediaMetadata,
} from '@/core/editor/media-export';
import { diagnoseTimeline } from '@/core/editor/timeline-diagnostics';
import { mergeTimelineDocuments } from '@/core/editor/timeline-merge';
import {
  buildTimelineDragPreview,
  timelineTimeFromClientX,
  type TimelineClipInteractionPreview,
  type TimelineDragMode,
} from '@/core/editor/timeline-interaction';
import { redoTimelineSelection } from '@/core/editor/beatapi-redo';
import { fetchRecentAssets } from '@/core/workspace-lib/app/workspace-client-api';
import { apiJsonGet, apiJsonPost } from '@/lib/api-client';
import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from '@/lib/trusted-local-request';

const MIN_CLIP_DURATION = 0.04;
export const PROJECT_TIMELINE_EXTERNAL_POLL_INTERVAL_MS = 2_000;

type TimelineDragSession = {
  clip: TimelineClip;
  mode: TimelineDragMode;
  originClientX: number;
  timelineWidth: number;
  timelineDuration: number;
  preview: TimelineClipInteractionPreview;
};

export function shouldPersistTimelineDocument({
  isHydrated,
  document,
  lastSavedDocument,
}: {
  isHydrated: boolean;
  document: TimelineDocument;
  lastSavedDocument: TimelineDocument | null;
}) {
  return (
    isHydrated &&
    (!lastSavedDocument ||
      !timelineDocumentsEqualForPersistence(document, lastSavedDocument))
  );
}

export function timelineDocumentsEqualForPersistence(
  left: TimelineDocument,
  right: TimelineDocument
) {
  const { updatedAt: _leftUpdatedAt, ...leftContent } = left;
  const { updatedAt: _rightUpdatedAt, ...rightContent } = right;
  return JSON.stringify(leftContent) === JSON.stringify(rightContent);
}

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(2).padStart(5, '0')}`;
};

const safeFilename = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'beatdesign-clip';

const saveTimelineThroughCommand = async ({
  projectId,
  document,
  expectedRevision,
  commandId = createCommandId(),
}: {
  projectId: string;
  document: TimelineDocument;
  expectedRevision: number | null;
  commandId?: string;
}) => {
  const result = await executeProjectCommand({
    projectId,
    commandId,
    idempotencyKey: commandId,
    expectedRevision,
    command: { type: 'editor.replace_document', document },
  });
  if (!result.ok) {
    const error = new Error(result.message) as Error & { code?: string };
    error.code = result.code;
    throw error;
  }
  if (!result.data.timeline || typeof result.revision !== 'number') {
    throw new Error('Timeline command returned no saved document.');
  }
  return { document: result.data.timeline, version: result.revision };
};

function TimelineClipBlock({
  clip,
  totalDuration,
  selected,
  onSelect,
  onPointerAction,
  trimStartLabel,
  trimEndLabel,
}: {
  clip: TimelineClip;
  totalDuration: number;
  selected: boolean;
  onSelect: () => void;
  onPointerAction: (
    mode: TimelineDragMode,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
  trimStartLabel: string;
  trimEndLabel: string;
}) {
  const left = totalDuration > 0 ? (clip.startTime / totalDuration) * 100 : 0;
  const width = totalDuration > 0 ? (clip.duration / totalDuration) * 100 : 100;

  return (
    <div
      className={`group absolute inset-y-1 touch-none overflow-hidden rounded-[9px] border text-left transition ${
        selected
          ? 'cursor-grab border-[var(--beat-accent)] bg-[#2a1a12] shadow-[0_0_0_1px_rgba(255,103,0,0.3),0_8px_24px_rgba(0,0,0,0.2)] active:cursor-grabbing'
          : clip.sourceType === 'audio'
            ? 'cursor-grab border-[var(--beat-graph)]/30 bg-[var(--beat-graph)]/12 hover:border-[var(--beat-graph)]/50 hover:bg-[var(--beat-graph)]/18 active:cursor-grabbing'
            : 'cursor-grab border-white/12 bg-[#202124] hover:border-white/24 hover:bg-[#242529] active:cursor-grabbing'
      }`}
      style={{ left: `${left}%`, width: `${Math.max(width, 1.2)}%` }}
      title={
        clip.sourceType === 'image'
          ? `${clip.name} · ${clip.duration.toFixed(2)}s`
          : `${clip.name} · ${formatTime(clip.inPoint)}–${formatTime(clip.outPoint)}`
      }
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerDown={(event) => onPointerAction('move', event)}
        className="absolute inset-0 z-10 cursor-grab touch-none overflow-hidden text-left active:cursor-grabbing"
        aria-label={`${clip.name} ${clip.duration.toFixed(2)}s`}
      >
        {clip.sourceType === 'image' ? (
          <img
            src={clip.sourceUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-48 transition group-hover:opacity-58"
          />
        ) : clip.sourceType === 'video' ? (
          <video
            src={clip.sourceUrl}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = Math.min(
                clip.inPoint + 0.05,
                Math.max(0, clip.outPoint - 0.05)
              );
            }}
            className="absolute inset-0 size-full object-cover opacity-28 transition group-hover:opacity-38"
          />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/38 to-black/10" />
        <span className="relative flex h-full min-w-0 flex-col justify-between px-2.5 py-2">
          <span className="block truncate text-[11px] font-[560] tracking-[-0.01em] text-white/95">
            {clip.name}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-[500] tabular-nums text-white/62">
            {clip.sourceType === 'image' ? (
              <ImageIcon className="size-3" />
            ) : clip.sourceType === 'video' ? (
              <FileVideo2 className="size-3" />
            ) : (
              <Volume2 className="size-3" />
            )}
            {clip.duration.toFixed(2)}s
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={trimStartLabel}
        title={trimStartLabel}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerAction('trim-start', event);
        }}
        className={`absolute inset-y-0 left-0 z-30 w-2.5 cursor-ew-resize touch-none transition ${
          selected
            ? 'bg-gradient-to-r from-[var(--beat-accent)]/80 to-transparent opacity-100'
            : 'opacity-0 group-hover:opacity-70'
        }`}
      >
        <span className="absolute bottom-2 left-1 top-2 w-px rounded-full bg-white/80" />
      </button>
      <button
        type="button"
        aria-label={trimEndLabel}
        title={trimEndLabel}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerAction('trim-end', event);
        }}
        className={`absolute inset-y-0 right-0 z-30 w-2.5 cursor-ew-resize touch-none transition ${
          selected
            ? 'bg-gradient-to-l from-[var(--beat-accent)]/80 to-transparent opacity-100'
            : 'opacity-0 group-hover:opacity-70'
        }`}
      >
        <span className="absolute bottom-2 right-1 top-2 w-px rounded-full bg-white/80" />
      </button>
    </div>
  );
}

export function VideoEditorWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useTranslations('AppShell.editor');
  const loadFailedMessage = t('errors.loadFailed');
  const saveFailedMessage = t('errors.saveFailed');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const sourceFileRef = useRef<File | null>(null);
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>());
  const imagePlaybackFrameRef = useRef<number | null>(null);
  const timelineDragRef = useRef<TimelineDragSession | null>(null);
  const timelineLoadedRef = useRef(false);
  const timelineVersionRef = useRef<number | null>(null);
  const lastSavedDocumentRef = useRef<TimelineDocument | null>(null);
  const saveQueueRef = useRef(Promise.resolve());
  const externalPollInFlightRef = useRef(false);
  const exportControllerRef = useRef<AbortController | null>(null);
  const documentRef = useRef<TimelineDocument | null>(null);
  const pastDocumentsRef = useRef<TimelineDocument[]>([]);
  const futureDocumentsRef = useRef<TimelineDocument[]>([]);
  const [document, setDocument] = useState(() =>
    createTimelineDocument({ projectId, name: projectName })
  );
  const [isTimelineHydrated, setIsTimelineHydrated] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<LocalMediaMetadata | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [timelineCursorTime, setTimelineCursorTime] = useState(0);
  const [timelineDragPreview, setTimelineDragPreview] =
    useState<TimelineClipInteractionPreview | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exactControlsOpen, setExactControlsOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [redoOpen, setRedoOpen] = useState(false);
  const [redoPrompt, setRedoPrompt] = useState('');
  const [redoStatus, setRedoStatus] = useState('');
  const [isRedoing, setIsRedoing] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clips = useMemo(
    () => document.tracks.flatMap((track) => track.clips),
    [document.tracks]
  );
  const selectedClip = selectedClipId
    ? findTimelineClip(document, selectedClipId)
    : undefined;
  const displayedSelectedClip =
    selectedClip && timelineDragPreview?.id === selectedClip.id
      ? { ...selectedClip, ...timelineDragPreview }
      : selectedClip;
  const selectedSource = selectedClip
    ? getTimelineClipSource(selectedClip)
    : null;
  const timelineCurrentTime = Math.max(
    0,
    Math.min(timelineCursorTime, document.duration)
  );
  const timelineDisplayDuration = Math.max(
    document.duration,
    timelineDragPreview
      ? timelineDragPreview.startTime + timelineDragPreview.duration
      : 0,
    0.001
  );
  const primaryVisualClip = clips.find((clip) => clip.sourceType !== 'audio');
  const canUndo = historyRevision >= 0 && pastDocumentsRef.current.length > 0;
  const canRedo = historyRevision >= 0 && futureDocumentsRef.current.length > 0;
  documentRef.current = document;

  const commitDocument = (
    updater: typeof document | ((current: typeof document) => typeof document)
  ) => {
    setDocument((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next === current || JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }
      pastDocumentsRef.current.push(current);
      if (pastDocumentsRef.current.length > 100) pastDocumentsRef.current.shift();
      futureDocumentsRef.current = [];
      setHistoryRevision((value) => value + 1);
      return next;
    });
  };

  const resetDocument = (next: typeof document) => {
    pastDocumentsRef.current = [];
    futureDocumentsRef.current = [];
    setHistoryRevision((value) => value + 1);
    setDocument(next);
  };

  const undoTimeline = () => {
    const previous = pastDocumentsRef.current.pop();
    if (!previous) return;
    futureDocumentsRef.current.push(document);
    setDocument(previous);
    setHistoryRevision((value) => value + 1);
  };

  const redoTimeline = () => {
    const next = futureDocumentsRef.current.pop();
    if (!next) return;
    pastDocumentsRef.current.push(document);
    setDocument(next);
    setHistoryRevision((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    timelineLoadedRef.current = false;
    setIsTimelineHydrated(false);
    void apiJsonGet<{
      timeline: { document: typeof document; version: number } | null;
    }>(`/api/app/projects/${encodeURIComponent(projectId)}/timeline`)
      .then((payload) => {
        if (!active) return;
        if (!payload.timeline) {
          const emptyDocument = createTimelineDocument({
            projectId,
            name: projectName,
          });
          timelineVersionRef.current = null;
          lastSavedDocumentRef.current = null;
          documentRef.current = emptyDocument;
          resetDocument(emptyDocument);
          setSelectedClipId(null);
          setSourceUrl(null);
          setMetadata(null);
          setCurrentTime(0);
          setTimelineCursorTime(0);
          timelineLoadedRef.current = true;
          setIsTimelineHydrated(true);
          return;
        }
        timelineVersionRef.current = payload.timeline.version;
        const nextDocument = payload.timeline.document;
        lastSavedDocumentRef.current = nextDocument;
        documentRef.current = nextDocument;
        const visualClips = nextDocument.tracks
          .flatMap((track) => track.clips)
          .filter((clip) => clip.sourceType !== 'audio');
        const requestedTimelineTime = Number(
          new URLSearchParams(window.location.search).get('t')
        );
        const requestedVisual = Number.isFinite(requestedTimelineTime)
          ? visualClips.find(
              (clip) =>
                requestedTimelineTime >= clip.startTime &&
                requestedTimelineTime < clip.startTime + clip.duration
            )
          : undefined;
        const firstVisual = requestedVisual ?? visualClips[0];
        resetDocument(nextDocument);
        setSelectedClipId(firstVisual?.id ?? null);
        const firstSource = firstVisual ? getTimelineClipSource(firstVisual) : null;
        const initialTimelineTime = firstVisual
          ? Number.isFinite(requestedTimelineTime)
            ? Math.max(
                firstVisual.startTime,
                Math.min(
                  firstVisual.startTime + firstVisual.duration,
                  requestedTimelineTime
                )
              )
            : firstVisual.startTime
          : 0;
        setSourceUrl(firstSource?.sourceUrl ?? null);
        setTimelineCursorTime(initialTimelineTime);
        setCurrentTime(
          firstVisual &&
            firstVisual.sourceType === 'video' &&
            firstSource &&
            Number.isFinite(requestedTimelineTime)
            ? firstSource.inPoint +
                Math.max(
                  0,
                  Math.min(
                    firstVisual.duration,
                    requestedTimelineTime - firstVisual.startTime
                  )
                )
            : (firstSource?.inPoint ?? 0)
        );
        setMetadata(
          firstVisual?.sourceType === 'video'
            ? {
                duration: firstVisual.sourceDuration,
                width: null,
                height: null,
                hasVideo: true,
                hasAudio: false,
                videoCodec: null,
                audioCodec: null,
              }
            : null
        );
        timelineLoadedRef.current = true;
        setIsTimelineHydrated(true);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : loadFailedMessage);
        }
      });
    return () => {
      active = false;
    };
  }, [loadFailedMessage, projectId, projectName]);

  useEffect(() => {
    if (
      !shouldPersistTimelineDocument({
        isHydrated: isTimelineHydrated,
        document,
        lastSavedDocument: lastSavedDocumentRef.current,
      })
    ) {
      setSaveStatus('saved');
      return;
    }
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      const saveCandidate = async () => {
        try {
          const saved = await saveTimelineThroughCommand({
            projectId,
            document,
            expectedRevision: timelineVersionRef.current,
          });
          timelineVersionRef.current = saved.version;
          lastSavedDocumentRef.current = saved.document;
          if (documentRef.current === document) {
            documentRef.current = saved.document;
            setDocument(saved.document);
          }
          setSaveStatus('saved');
        } catch (cause) {
          if (
            cause instanceof Error &&
            (cause as Error & { code?: string }).code === 'REVISION_CONFLICT'
          ) {
            const latest = await apiJsonGet<{
              timeline: { document: TimelineDocument; version: number } | null;
            }>(`/api/app/projects/${encodeURIComponent(projectId)}/timeline`);
            const base = lastSavedDocumentRef.current;
            if (base && latest.timeline) {
              const merged = mergeTimelineDocuments({
                base,
                local: document,
                remote: latest.timeline.document,
              });
              if (merged.conflicts.length === 0) {
                const saved = await saveTimelineThroughCommand({
                  projectId,
                  document: merged.document,
                  expectedRevision: latest.timeline.version,
                });
                timelineVersionRef.current = saved.version;
                lastSavedDocumentRef.current = saved.document;
                if (
                  documentRef.current &&
                  timelineDocumentsEqualForPersistence(
                    documentRef.current,
                    document
                  )
                ) {
                  documentRef.current = saved.document;
                  setDocument(saved.document);
                }
                setSaveStatus('saved');
                return;
              }
              timelineVersionRef.current = latest.timeline.version;
              lastSavedDocumentRef.current = latest.timeline.document;
              throw new Error(
                `Timeline edit conflict at ${merged.conflicts[0].path}. Your local edit is still open.`
              );
            }
          }
          setSaveStatus('idle');
          setError(cause instanceof Error ? cause.message : saveFailedMessage);
        }
      };
      const queued = saveQueueRef.current.then(saveCandidate, saveCandidate);
      saveQueueRef.current = queued.catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [clips.length, document, isTimelineHydrated, projectId, saveFailedMessage]);

  useEffect(() => {
    if (!isTimelineHydrated) return;
    const pollExternalTimeline = async () => {
      if (saveStatus === 'saving') return;
      const current = documentRef.current;
      const saved = lastSavedDocumentRef.current;
      if (
        current &&
        saved &&
        !timelineDocumentsEqualForPersistence(current, saved)
      ) {
        return;
      }
      if (externalPollInFlightRef.current) return;
      externalPollInFlightRef.current = true;
      try {
        const payload = await apiJsonGet<{
          timeline: { document: TimelineDocument; version: number } | null;
        }>(`/api/app/projects/${encodeURIComponent(projectId)}/timeline`);
        const remote = payload.timeline;
        if (!remote) return;
        const localVersion = timelineVersionRef.current;
        if (
          typeof localVersion === 'number' &&
          remote.version <= localVersion
        ) {
          return;
        }
        timelineVersionRef.current = remote.version;
        lastSavedDocumentRef.current = remote.document;
        documentRef.current = remote.document;
        resetDocument(remote.document);

        const remoteVisualClips = remote.document.tracks
          .flatMap((track) => track.clips)
          .filter((clip) => clip.sourceType !== 'audio');
        const nextSelectedClip =
          (selectedClipId
            ? remoteVisualClips.find((clip) => clip.id === selectedClipId)
            : undefined) ?? remoteVisualClips[0];
        const nextSource = nextSelectedClip
          ? getTimelineClipSource(nextSelectedClip)
          : null;
        setSelectedClipId(nextSelectedClip?.id ?? null);
        setSourceUrl(nextSource?.sourceUrl ?? null);
        setTimelineCursorTime((time) =>
          Math.max(0, Math.min(time, remote.document.duration))
        );
        setCurrentTime((time) =>
          nextSelectedClip
            ? Math.max(
                nextSource?.inPoint ?? 0,
                Math.min(time, nextSource?.outPoint ?? nextSelectedClip.duration)
              )
            : 0
        );
        setMetadata(
          nextSelectedClip?.sourceType === 'video'
            ? {
                duration: nextSelectedClip.sourceDuration,
                width: null,
                height: null,
                hasVideo: true,
                hasAudio: false,
                videoCodec: null,
                audioCodec: null,
              }
            : null
        );
      } catch {
        // External refresh is best-effort; the next poll retries automatically.
      } finally {
        externalPollInFlightRef.current = false;
      }
    };

    const pollWhenVisible = () => {
      if (globalThis.document.visibilityState === 'visible') {
        void pollExternalTimeline();
      }
    };

    void pollExternalTimeline();
    const timer = window.setInterval(
      () => void pollExternalTimeline(),
      PROJECT_TIMELINE_EXTERNAL_POLL_INTERVAL_MS
    );
    window.addEventListener('focus', pollWhenVisible);
    globalThis.document.addEventListener('visibilitychange', pollWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', pollWhenVisible);
      globalThis.document.removeEventListener(
        'visibilitychange',
        pollWhenVisible
      );
    };
  }, [isTimelineHydrated, projectId, saveStatus, selectedClipId]);

  useEffect(() => {
    const flushTimeline = () => {
      const current = documentRef.current;
      if (!timelineLoadedRef.current || !current) {
        return;
      }
      const commandId = createCommandId();
      void fetch(
        `/api/app/projects/${encodeURIComponent(projectId)}/commands`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
          },
          body: JSON.stringify({
            commandId,
            idempotencyKey: commandId,
            expectedRevision: timelineVersionRef.current,
            command: { type: 'editor.replace_document', document: current },
          }),
          keepalive: true,
        }
      ).catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (globalThis.document.visibilityState === 'hidden') flushTimeline();
    };
    window.addEventListener('pagehide', flushTimeline);
    globalThis.document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushTimeline);
      globalThis.document.removeEventListener(
        'visibilitychange',
        onVisibilityChange
      );
    };
  }, [projectId]);

  useEffect(
    () => () => {
      if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl]
  );

  useEffect(
    () => () => {
      if (imagePlaybackFrameRef.current !== null) {
        cancelAnimationFrame(imagePlaybackFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedClip || selectedClip.sourceType === 'audio') return;
    const nextSource = getTimelineClipSource(selectedClip);
    if (sourceUrl !== nextSource.sourceUrl) {
      sourceFileRef.current = null;
      setSourceUrl(nextSource.sourceUrl);
      setCurrentTime(
        selectedClip.sourceType === 'video' ? nextSource.inPoint : 0
      );
      setTimelineCursorTime(selectedClip.startTime);
    }
  }, [selectedClip?.activeTakeId, selectedClip?.id, selectedClip?.sourceUrl, sourceUrl]);

  const stopImagePlayback = () => {
    if (imagePlaybackFrameRef.current !== null) {
      cancelAnimationFrame(imagePlaybackFrameRef.current);
      imagePlaybackFrameRef.current = null;
    }
    setIsPlaying(false);
  };

  const seek = (time: number, timelineTime?: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = time;
    setCurrentTime(time);
    setTimelineCursorTime(
      timelineTime ??
        (selectedClip && selectedSource
          ? selectedClip.startTime + (time - selectedSource.inPoint)
          : time)
    );
  };

  const syncAudioTracks = (sourceTime: number, shouldPlay: boolean) => {
    if (!selectedClip || !selectedSource) return;
    const timelineTime =
      selectedClip.startTime + (sourceTime - selectedSource.inPoint);
    for (const clip of clips.filter((item) => item.sourceType === 'audio')) {
      const audio = audioElementsRef.current.get(clip.id);
      if (!audio) continue;
      const offset = timelineTime - clip.startTime;
      const active = offset >= 0 && offset < clip.duration && !clip.muted;
      if (!active) {
        audio.pause();
        continue;
      }
      const target = clip.inPoint + offset;
      if (Math.abs(audio.currentTime - target) > 0.12) audio.currentTime = target;
      const fadeInGain = clip.fadeIn > 0 ? Math.min(1, offset / clip.fadeIn) : 1;
      const fadeOutGain =
        clip.fadeOut > 0
          ? Math.min(1, (clip.duration - offset) / clip.fadeOut)
          : 1;
      audio.volume = Math.max(
        0,
        Math.min(1, clip.volume * Math.min(fadeInGain, fadeOutGain))
      );
      if (shouldPlay && audio.paused) void audio.play().catch(() => undefined);
    }
  };

  const selectClip = (clip: TimelineClip, timelineTime = clip.startTime) => {
    stopImagePlayback();
    setSelectedClipId(clip.id);
    if (clip.sourceType !== 'audio') {
      const source = getTimelineClipSource(clip);
      const offset = Math.max(
        0,
        Math.min(clip.duration, timelineTime - clip.startTime)
      );
      setSourceUrl(source.sourceUrl);
      sourceFileRef.current = null;
      setTimelineCursorTime(clip.startTime + offset);
      if (clip.sourceType === 'video') {
        const sourceTime = source.inPoint + offset;
        if (videoRef.current) videoRef.current.currentTime = sourceTime;
        setCurrentTime(sourceTime);
      } else {
        videoRef.current?.pause();
        setCurrentTime(offset);
        setMetadata(null);
      }
    } else {
      videoRef.current?.pause();
      setTimelineCursorTime(clip.startTime);
    }
  };

  const seekTimeline = (requestedTime: number) => {
    const timelineTime = Math.max(
      0,
      Math.min(document.duration, requestedTime)
    );
    const visualClips = clips
      .filter((clip) => clip.sourceType !== 'audio')
      .sort((a, b) => a.startTime - b.startTime);
    const activeClip =
      visualClips.find(
        (clip) =>
          timelineTime >= clip.startTime &&
          timelineTime < clip.startTime + clip.duration
      ) ??
      [...visualClips]
        .reverse()
        .find(
          (clip) =>
            timelineTime === document.duration &&
            Math.abs(clip.startTime + clip.duration - timelineTime) < 0.001
        );

    if (!activeClip) {
      videoRef.current?.pause();
      stopImagePlayback();
      setTimelineCursorTime(timelineTime);
      return;
    }
    if (activeClip.id !== selectedClipId) {
      selectClip(activeClip, timelineTime);
      return;
    }
    const offset = Math.max(
      0,
      Math.min(activeClip.duration, timelineTime - activeClip.startTime)
    );
    setTimelineCursorTime(activeClip.startTime + offset);
    if (activeClip.sourceType === 'video') {
      seek(activeClip.inPoint + offset, activeClip.startTime + offset);
    } else {
      setCurrentTime(offset);
    }
  };

  const loadFile = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setError(t('errors.visualOnly'));
      return;
    }

    setError(null);
    setIsInspecting(true);
    try {
      const nextMetadata = isVideo ? await inspectLocalMedia(file) : null;
      if (isVideo && (!nextMetadata?.hasVideo || nextMetadata.duration <= 0)) {
        throw new Error(t('errors.noVideoTrack'));
      }
      const imageBitmap = isImage ? await createImageBitmap(file) : null;

      const persistedAsset = await uploadLocalProjectAsset({
        projectId,
        file,
        width: imageBitmap?.width ?? nextMetadata?.width ?? undefined,
        height: imageBitmap?.height ?? nextMetadata?.height ?? undefined,
        durationMs: nextMetadata ? nextMetadata.duration * 1000 : undefined,
      });
      imageBitmap?.close();
      const nextDocument = applyEditorOperations(document, [
        {
          type: 'add_clip',
          assetId: persistedAsset.id,
          sourceUrl: persistedAsset.publicUrl,
          name: file.name,
          sourceType: isImage ? 'image' : 'video',
          sourceDuration: nextMetadata?.duration ?? DEFAULT_IMAGE_CLIP_DURATION,
        },
      ]).document;
      const nextClip = nextDocument.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.assetId === persistedAsset.id);

      if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
      sourceFileRef.current = isVideo ? file : null;
      setSourceUrl(persistedAsset.publicUrl);
      setMetadata(nextMetadata);
      commitDocument(nextDocument);
      setSelectedClipId(nextClip?.id ?? null);
      setCurrentTime(0);
      setTimelineCursorTime(nextClip?.startTime ?? 0);
      setIsPlaying(false);
      setExportProgress(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.inspectFailed'));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) void loadFile(file);
    event.target.value = '';
  };

  const loadAudioFile = async (file: File) => {
    if (
      !file.type.startsWith('audio/') &&
      !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)
    ) {
      setError(t('errors.audioOnly'));
      return;
    }
    setError(null);
    setIsInspecting(true);
    try {
      const audioMetadata = await inspectLocalMedia(file);
      if (!audioMetadata.hasAudio || audioMetadata.duration <= 0) {
        throw new Error(t('errors.noAudioTrack'));
      }
      const persistedAsset = await uploadLocalProjectAsset({
        projectId,
        file,
        durationMs: audioMetadata.duration * 1000,
      });
      const nextDocument = applyEditorOperations(document, [
        {
          type: 'add_clip',
          assetId: persistedAsset.id,
          sourceUrl: persistedAsset.publicUrl,
          name: file.name,
          sourceType: 'audio',
          sourceDuration: audioMetadata.duration,
          startTime: 0,
          audioRole: 'music',
        },
      ]).document;
      const nextClip = nextDocument.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.assetId === persistedAsset.id);
      commitDocument(nextDocument);
      setSelectedClipId(nextClip?.id ?? selectedClipId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.inspectFailed'));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleAudioInput = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) void loadAudioFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    if (!file) return;
    if (
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)
    ) {
      void loadAudioFile(file);
      return;
    }
    void loadFile(file);
  };

  const togglePlayback = async () => {
    if (!selectedClip || !selectedSource || selectedClip.sourceType === 'audio') {
      return;
    }
    if (selectedClip.sourceType === 'image') {
      if (isPlaying) {
        stopImagePlayback();
        syncAudioTracks(currentTime, false);
        return;
      }
      const initialOffset =
        currentTime >= selectedClip.duration - MIN_CLIP_DURATION
          ? 0
          : Math.max(0, currentTime);
      const startedAt = performance.now() - initialOffset * 1000;
      setIsPlaying(true);
      const tick = (now: number) => {
        const offset = Math.min(
          selectedClip.duration,
          Math.max(0, (now - startedAt) / 1000)
        );
        setCurrentTime(offset);
        setTimelineCursorTime(selectedClip.startTime + offset);
        syncAudioTracks(offset, true);
        if (offset >= selectedClip.duration) {
          imagePlaybackFrameRef.current = null;
          setIsPlaying(false);
          syncAudioTracks(offset, false);
          return;
        }
        imagePlaybackFrameRef.current = requestAnimationFrame(tick);
      };
      imagePlaybackFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (
      video.currentTime < selectedSource.inPoint ||
      video.currentTime >= selectedSource.outPoint
    ) {
      seek(selectedSource.inPoint);
    }
    await video.play();
  };

  const updateTrim = (edge: 'in' | 'out', value: number) => {
    if (!selectedClip || selectedClip.activeTakeId) return;
    const nextIn =
      edge === 'in'
        ? Math.min(value, selectedClip.outPoint - MIN_CLIP_DURATION)
        : selectedClip.inPoint;
    const nextOut =
      edge === 'out'
        ? Math.max(value, selectedClip.inPoint + MIN_CLIP_DURATION)
        : selectedClip.outPoint;
    commitDocument((current) =>
      applyEditorOperations(current, [
        {
          type: 'trim_clip',
          clipId: selectedClip.id,
          inPoint: nextIn,
          outPoint: nextOut,
        },
      ]).document
    );
    if (selectedClip.sourceType === 'video') {
      seek(edge === 'in' ? nextIn : nextOut);
    }
  };

  const resizeSelectedImage = (duration: number) => {
    if (!selectedClip || selectedClip.sourceType !== 'image') return;
    commitDocument((current) =>
      applyEditorOperations(current, [
        {
          type: 'set_clip_duration',
          clipId: selectedClip.id,
          duration: Math.max(MIN_CLIP_DURATION, duration),
        },
      ]).document
    );
  };

  const splitAtPlayhead = () => {
    if (!selectedClip || selectedClip.activeTakeId) return;
    const nextDocument = applyEditorOperations(document, [
      {
        type: 'split_clip',
        clipId: selectedClip.id,
        sourceTime: currentTime,
      },
    ]).document;
    if (nextDocument === document) return;
    commitDocument(nextDocument);
    const rightClip = nextDocument.tracks
      .flatMap((track) => track.clips)
      .find(
        (clip) =>
          clip.assetId === selectedClip.assetId &&
          Math.abs(clip.inPoint - currentTime) < 0.001
      );
    setSelectedClipId(rightClip?.id ?? selectedClip.id);
  };

  const moveSelectedClip = (startTime: number) => {
    if (!selectedClip) return;
    let next: TimelineDocument;
    try {
      next = applyEditorOperations(document, [
        { type: 'move_clip', clipId: selectedClip.id, startTime },
      ]).document;
    } catch {
      setError(t('errors.clipOverlap'));
      return;
    }
    commitDocument(next);
  };

  const beginTimelineDrag = (
    clip: TimelineClip,
    mode: TimelineDragMode,
    event: ReactPointerEvent<HTMLElement>
  ) => {
    if (mode !== 'move' && clip.activeTakeId) return;
    const timelineTrack = event.currentTarget.closest<HTMLElement>(
      '[data-timeline-track]'
    );
    if (!timelineTrack || document.duration <= 0) return;
    event.preventDefault();
    videoRef.current?.pause();
    stopImagePlayback();
    if (selectedClipId !== clip.id) selectClip(clip);

    const rect = timelineTrack.getBoundingClientRect();
    const initialPreview: TimelineClipInteractionPreview = {
      id: clip.id,
      startTime: clip.startTime,
      duration: clip.duration,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
      sourceDuration: clip.sourceDuration,
    };
    timelineDragRef.current = {
      clip,
      mode,
      originClientX: event.clientX,
      timelineWidth: rect.width,
      timelineDuration: Math.max(document.duration, 0.001),
      preview: initialPreview,
    };
    setTimelineDragPreview(initialPreview);

    const finishDrag = () => {
      const session = timelineDragRef.current;
      timelineDragRef.current = null;
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      setTimelineDragPreview(null);
      if (!session) return;
      const preview = session.preview;
      if (
        preview.startTime === session.clip.startTime &&
        preview.duration === session.clip.duration &&
        preview.inPoint === session.clip.inPoint &&
        preview.outPoint === session.clip.outPoint
      ) {
        return;
      }

      const operations: EditorOperation[] = [];
      if (session.mode === 'move') {
        operations.push({
          type: 'move_clip',
          clipId: session.clip.id,
          startTime: preview.startTime,
        });
      } else if (session.clip.sourceType === 'image') {
        operations.push({
          type: 'set_clip_duration',
          clipId: session.clip.id,
          duration: preview.duration,
        });
        if (session.mode === 'trim-start') {
          operations.push({
            type: 'move_clip',
            clipId: session.clip.id,
            startTime: preview.startTime,
          });
        }
      } else {
        operations.push({
          type: 'trim_clip',
          clipId: session.clip.id,
          inPoint: preview.inPoint,
          outPoint: preview.outPoint,
        });
        if (session.mode === 'trim-start') {
          operations.push({
            type: 'move_clip',
            clipId: session.clip.id,
            startTime: preview.startTime,
          });
        }
      }

      try {
        const next = applyEditorOperations(document, operations).document;
        commitDocument(next);
        const nextCursor = Math.max(
          preview.startTime,
          Math.min(
            preview.startTime + preview.duration,
            timelineCurrentTime
          )
        );
        setTimelineCursorTime(nextCursor);
        if (session.clip.sourceType === 'image') {
          setCurrentTime(nextCursor - preview.startTime);
        } else {
          setCurrentTime(preview.inPoint + (nextCursor - preview.startTime));
        }
      } catch {
        setError(t('errors.clipOverlap'));
      }
    };

    const moveDrag = (pointerEvent: PointerEvent) => {
      const session = timelineDragRef.current;
      if (!session || session.timelineWidth <= 0) return;
      const deltaTime =
        ((pointerEvent.clientX - session.originClientX) /
          session.timelineWidth) *
        session.timelineDuration;
      const preview = buildTimelineDragPreview({
        document,
        clip: session.clip,
        mode: session.mode,
        deltaTime,
      });
      session.preview = preview;
      setTimelineDragPreview(preview);
    };

    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  const deleteSelectedClip = (ripple: boolean) => {
    if (!selectedClip) return;
    commitDocument(
      applyEditorOperations(document, [
        { type: 'remove_clip', clipId: selectedClip.id, ripple },
      ]).document
    );
    setSelectedClipId(null);
    videoRef.current?.pause();
    stopImagePlayback();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const commandKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (commandKey && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoTimeline();
        else undoTimeline();
        return;
      }
      if (commandKey && key === 'b') {
        event.preventDefault();
        splitAtPlayhead();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlayback();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedClip) return;
        event.preventDefault();
        deleteSelectedClip(false);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        seekTimeline(
          timelineCurrentTime + direction * (event.shiftKey ? 1 : 0.04)
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const createDerivedSelection = async () => {
    if (!selectedClip || !selectedSource) return null;
    setError(null);
    setIsExporting(true);
    setExportProgress(0);
    try {
      let file = sourceFileRef.current;
      if (!file || selectedSource.assetId !== clips[0]?.assetId) {
        const response = await fetch(selectedSource.sourceUrl);
        if (!response.ok) throw new Error(t('errors.sourceUnavailable'));
        const blob = await response.blob();
        file = new File([blob], selectedSource.name, {
          type: blob.type || 'video/mp4',
        });
        sourceFileRef.current = file;
      }
      const blob = await exportTrimmedMp4({
        file,
        start: selectedSource.inPoint,
        end: selectedSource.outPoint,
        onProgress: setExportProgress,
      });
      const filename = `${safeFilename(selectedSource.name)}-${selectedSource.inPoint.toFixed(2)}-${selectedSource.outPoint.toFixed(2)}.mp4`;
      const derivedFile = new File([blob], filename, { type: 'video/mp4' });
      const derivedMetadata = await inspectLocalMedia(derivedFile);
      const asset = await uploadLocalProjectAsset({
        projectId,
        file: derivedFile,
        assetClass: 'derived',
        width: derivedMetadata.width ?? undefined,
        height: derivedMetadata.height ?? undefined,
        durationMs: selectedClip.duration * 1000,
        metadata: {
          parentAssetId: selectedSource.assetId,
          sourceInSec: selectedSource.inPoint,
          sourceOutSec: selectedSource.outPoint,
          operation: 'timeline_extract',
          timelineId: document.id,
          clipId: selectedClip.id,
        },
      });
      return { asset, file: derivedFile, blob, filename };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.exportFailed'));
      return null;
    } finally {
      setIsExporting(false);
    }
  };

  const exportSelection = () =>
    void (async () => {
      const blockingDiagnostic = diagnoseTimeline(document).find(
        (diagnostic) => diagnostic.severity === 'error'
      );
      if (blockingDiagnostic) {
        setError(t(`diagnostics.${blockingDiagnostic.code}`));
        return;
      }

      setError(null);
      setIsExporting(true);
      setExportProgress(0);
      const controller = new AbortController();
      exportControllerRef.current = controller;
      try {
        const blob = await exportTimelineMp4({
          document,
          signal: controller.signal,
          onProgress: setExportProgress,
        });
        const filename = `${safeFilename(document.name)}-timeline.mp4`;
        const renderFile = new File([blob], filename, { type: 'video/mp4' });
        const renderMetadata = await inspectLocalMedia(renderFile);
        const asset = await uploadLocalProjectAsset({
          projectId,
          file: renderFile,
          assetClass: 'derived',
          width: renderMetadata.width ?? undefined,
          height: renderMetadata.height ?? undefined,
          durationMs: document.duration * 1000,
          metadata: {
            operation: 'timeline_render',
            timelineId: document.id,
            clipCount: clips.length,
          },
        });
        const nextDocument = applyEditorOperations(document, [
          {
            type: 'set_render',
            assetId: asset.id,
            publicUrl: asset.publicUrl,
          },
        ]).document;
        commitDocument(nextDocument);
        const saved = await saveTimelineThroughCommand({
          projectId,
          document: nextDocument,
          expectedRevision: timelineVersionRef.current,
        });
        timelineVersionRef.current = saved.version;
        lastSavedDocumentRef.current = saved.document;
        await apiJsonPost(
          `/api/app/projects/${encodeURIComponent(projectId)}/timeline`,
          {}
        );
        downloadBlob(blob, filename);
      } catch (cause) {
        setError(
          cause instanceof DOMException && cause.name === 'AbortError'
            ? t('errors.exportCancelled')
            : cause instanceof Error
              ? cause.message
              : t('errors.exportFailed')
        );
      } finally {
        exportControllerRef.current = null;
        setIsExporting(false);
      }
    })();

  const addTimelineToCanvas = async () => {
    try {
      const saved = await saveTimelineThroughCommand({
        projectId,
        document,
        expectedRevision: timelineVersionRef.current,
      });
      timelineVersionRef.current = saved.version;
      lastSavedDocumentRef.current = saved.document;
      await apiJsonPost(
        `/api/app/projects/${encodeURIComponent(projectId)}/timeline`,
        {}
      );
      setRedoStatus(t('status.canvasAdded'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.canvasNodeFailed'));
    }
  };

  const runRedo = async () => {
    if (!selectedClip || selectedClip.sourceType !== 'video') return;
    setIsRedoing(true);
    setError(null);
    setRedoStatus(t('redo.preparing'));
    try {
      const derived = await createDerivedSelection();
      if (!derived) return;
      const result = await redoTimelineSelection({
        projectId,
        file: derived.file,
        prompt: redoPrompt,
        durationSec: selectedClip.duration,
        onStatus: (status) => setRedoStatus(t(`redo.status.${status}`)),
      });
      const resultFileResponse = await fetch(result.resultUrl);
      if (!resultFileResponse.ok) throw new Error(t('errors.sourceUnavailable'));
      const resultBlob = await resultFileResponse.blob();
      const resultFile = new File([resultBlob], 'beatapi-redo.mp4', {
        type: resultBlob.type || 'video/mp4',
      });
      const resultMetadata = await inspectLocalMedia(resultFile);
      const assets = await fetchRecentAssets(projectId);
      const resultAsset = assets.videos.find(
        (asset) =>
          asset.id === result.assetId || asset.publicUrl === result.resultUrl
      );
      if (!resultAsset && !result.assetId) {
        throw new Error(t('errors.redoAssetMissing'));
      }
      commitDocument((current) =>
        applyEditorOperations(current, [
          {
            type: 'add_take',
            clipId: selectedClip.id,
            take: {
              assetId: resultAsset?.id ?? result.assetId!,
              sourceUrl: result.resultUrl,
              name: `${selectedClip.name} · AI Take`,
              sourceDuration: resultMetadata.duration,
              sourceGenerationId: result.generationId,
              prompt: redoPrompt.trim(),
            },
          },
        ]).document
      );
      setRedoStatus(t('redo.ready'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.redoFailed'));
      setRedoStatus('');
    } finally {
      setIsRedoing(false);
    }
  };

  const activateTake = (takeId: string | null) => {
    if (!selectedClip) return;
    const next = applyEditorOperations(document, [
      { type: 'activate_take', clipId: selectedClip.id, takeId },
    ]).document;
    const nextClip = findTimelineClip(next, selectedClip.id);
    if (!nextClip) return;
    const nextSource = getTimelineClipSource(nextClip);
    commitDocument(next);
    setSourceUrl(nextSource.sourceUrl);
    sourceFileRef.current = null;
    seek(nextSource.inPoint);
  };

  return (
    <div
      className="beat-product-shell flex min-h-0 flex-1 flex-col bg-[var(--beat-bg)] text-[var(--beat-text-1)]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm,image/*,video/*"
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
        className="hidden"
        onChange={handleAudioInput}
      />
      {clips
        .filter((clip) => clip.sourceType === 'audio')
        .map((clip) => (
          <audio
            key={clip.id}
            ref={(element) => {
              if (element) audioElementsRef.current.set(clip.id, element);
              else audioElementsRef.current.delete(clip.id);
            }}
            src={clip.sourceUrl}
            preload="auto"
            className="hidden"
          />
        ))}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.07] bg-[var(--beat-surface)] p-4 lg:block">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-[540] tracking-[-0.01em] text-white/42">
                {t('media.eyebrow')}
              </p>
              <h2 className="mt-1 text-sm font-semibold text-white">
                {t('media.title')}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                aria-label={t('actions.importAudio')}
                title={t('actions.importAudio')}
              >
                <Music2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                aria-label={t('actions.import')}
              >
                <Upload className="size-4" />
              </button>
            </div>
          </div>
          {primaryVisualClip ? (
            <button
              type="button"
              onClick={() => selectClip(primaryVisualClip)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-white/20"
            >
              <div className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black/55">
                {primaryVisualClip.sourceType === 'image' ? (
                  <img
                    src={primaryVisualClip.sourceUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <video
                    src={primaryVisualClip.sourceUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover opacity-75"
                  />
                )}
              </div>
              <p className="truncate text-xs font-medium text-white">
                {primaryVisualClip.name}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                {metadata?.width && metadata.height
                  ? `${metadata.width}×${metadata.height} · `
                  : ''}
                {primaryVisualClip.sourceType === 'image'
                  ? t('media.stillDuration', {
                      duration: primaryVisualClip.duration.toFixed(1),
                    })
                  : formatTime(
                      metadata?.duration ?? primaryVisualClip.sourceDuration
                    )}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center rounded-xl border border-dashed border-white/12 px-4 py-8 text-center text-white/40 transition hover:border-[var(--beat-accent)]/50 hover:bg-white/[0.025] hover:text-white/70"
            >
              <Upload className="mb-3 size-5" />
              <span className="text-xs font-medium">{t('media.drop')}</span>
              <span className="mt-1 text-[11px]">{t('media.localOnly')}</span>
            </button>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-3 sm:px-4">
            <div className="flex items-center gap-2 text-xs text-white/55">
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-[520] tabular-nums tracking-[-0.01em]">
                {metadata?.width && metadata.height
                  ? `${metadata.width}×${metadata.height}`
                  : '—'}
              </span>
              <span className="hidden sm:inline">
                {metadata?.videoCodec?.toUpperCase() ?? t('status.ready')}
              </span>
              {saveStatus !== 'idle' ? (
                <span className="text-white/35">
                  {saveStatus === 'saving' ? t('status.saving') : t('status.saved')}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center rounded-lg border border-white/10 sm:flex">
                <button
                  type="button"
                  onClick={undoTimeline}
                  disabled={!canUndo}
                  className="grid size-8 place-items-center text-white/55 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                  aria-label={t('actions.undo')}
                  title={t('actions.undo')}
                >
                  <Undo2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={redoTimeline}
                  disabled={!canRedo}
                  className="grid size-8 place-items-center border-l border-white/10 text-white/55 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                  aria-label={t('actions.redoEdit')}
                  title={t('actions.redoEdit')}
                >
                  <Redo2 className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void addTimelineToCanvas()}
                disabled={clips.length === 0}
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-35 md:inline-flex"
              >
                {t('actions.addTimelineToCanvas')}
              </button>
              <button
                type="button"
                onClick={() => void createDerivedSelection()}
                disabled={!selectedClip || selectedClip.sourceType !== 'video' || isExporting}
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-35 sm:inline-flex"
              >
                <Scissors className="size-3.5" />
                {t('actions.extract')}
              </button>
              <button
                type="button"
                onClick={() => setRedoOpen((current) => !current)}
                disabled={!selectedClip || selectedClip.sourceType !== 'video' || isRedoing}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                title={t('actions.redoHint')}
              >
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">{t('actions.redo')}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  isExporting
                    ? exportControllerRef.current?.abort()
                    : exportSelection()
                }
                disabled={
                  !isExporting && !clips.some((clip) => clip.sourceType !== 'audio')
                }
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  isExporting
                    ? 'border border-white/12 bg-white/[0.06] hover:bg-white/[0.1]'
                    : 'bg-[var(--beat-accent)] hover:brightness-110'
                }`}
              >
                <Download className="size-3.5" />
                {isExporting
                  ? t('actions.cancelExport', {
                      progress: Math.round(exportProgress * 100),
                    })
                  : t('actions.export')}
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/35 p-4 sm:p-8">
            {sourceUrl && selectedClip?.sourceType === 'image' ? (
              <img
                src={sourceUrl}
                alt={selectedClip.name}
                className="h-full w-full max-w-5xl rounded-xl bg-black object-contain shadow-2xl"
              />
            ) : sourceUrl && selectedClip?.sourceType === 'video' ? (
              <video
                ref={videoRef}
                src={sourceUrl}
                playsInline
                className="h-full w-full max-w-5xl rounded-xl bg-black object-contain shadow-2xl"
                onLoadedMetadata={(event) => {
                  if (!selectedClip || !selectedSource) return;
                  const target = Math.max(
                    selectedSource.inPoint,
                    Math.min(selectedSource.outPoint, currentTime)
                  );
                  event.currentTarget.currentTime = target;
                }}
                onPlay={(event) => {
                  setIsPlaying(true);
                  syncAudioTracks(event.currentTarget.currentTime, true);
                }}
                onPause={(event) => {
                  setIsPlaying(false);
                  syncAudioTracks(event.currentTarget.currentTime, false);
                }}
                onTimeUpdate={(event) => {
                  const time = event.currentTarget.currentTime;
                  if (selectedClip && selectedSource && time >= selectedSource.outPoint) {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = selectedSource.outPoint;
                    setCurrentTime(selectedSource.outPoint);
                    setTimelineCursorTime(
                      selectedClip.startTime + selectedClip.duration
                    );
                    return;
                  }
                  setCurrentTime(time);
                  if (selectedClip && selectedSource) {
                    setTimelineCursorTime(
                      selectedClip.startTime + (time - selectedSource.inPoint)
                    );
                  }
                  syncAudioTracks(time, !event.currentTarget.paused);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex max-w-md flex-col items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.018] px-10 py-12 text-center transition hover:border-[var(--beat-accent)]/45 hover:bg-white/[0.03]"
              >
                <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--beat-accent)]/12 text-[var(--beat-accent)]">
                  <ImageIcon className="size-6" />
                </span>
                <span className="text-sm font-semibold text-white">
                  {isInspecting ? t('status.reading') : t('empty.title')}
                </span>
                <span className="mt-2 text-xs leading-5 text-white/40">
                  {t('empty.description')}
                </span>
              </button>
            )}

            {redoOpen && selectedClip?.sourceType === 'video' ? (
              <aside className="absolute bottom-4 right-4 top-4 z-20 flex w-[min(340px,calc(100%-2rem))] flex-col rounded-2xl border border-white/10 bg-[#111214]/96 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{t('redo.title')}</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/42">
                      {t('redo.description')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRedoOpen(false)}
                    className="text-lg leading-none text-white/35 hover:text-white"
                    aria-label={t('redo.close')}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-white/75">Seedance 2</span>
                    <span className="font-[520] tabular-nums tracking-[-0.01em] text-white/42">{selectedClip.duration.toFixed(2)}s</span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/35">{t('redo.billingNotice')}</p>
                </div>
                <textarea
                  value={redoPrompt}
                  onChange={(event) => setRedoPrompt(event.target.value)}
                  placeholder={t('redo.placeholder')}
                  maxLength={5000}
                  className="mt-3 min-h-24 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs leading-5 text-white outline-none placeholder:text-white/25 focus:border-[var(--beat-accent)]/55"
                />
                <button
                  type="button"
                  onClick={() => void runRedo()}
                  disabled={isRedoing || !redoPrompt.trim()}
                  className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--beat-accent)] px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                >
                  <Sparkles className="size-3.5" />
                  {isRedoing ? t('redo.running') : t('redo.confirm')}
                </button>
                {redoStatus ? (
                  <p className="mt-2 text-center text-[10px] text-white/42">{redoStatus}</p>
                ) : null}
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t border-white/[0.07] pt-3">
                  <p className="mb-2 text-[10px] font-[540] tracking-[-0.01em] text-white/36">
                    {t('redo.takes')}
                  </p>
                  <button
                    type="button"
                    onClick={() => activateTake(null)}
                    className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[11px] ${
                      !selectedClip.activeTakeId
                        ? 'border-[var(--beat-graph)]/50 bg-[var(--beat-graph)]/10 text-white'
                        : 'border-white/[0.08] text-white/55 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span>{t('redo.original')}</span>
                    {!selectedClip.activeTakeId ? <span>✓</span> : null}
                  </button>
                  {selectedClip.takes.map((take, index) => (
                    <button
                      key={take.id}
                      type="button"
                      onClick={() => activateTake(take.id)}
                      className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[11px] ${
                        selectedClip.activeTakeId === take.id
                          ? 'border-[var(--beat-accent)]/55 bg-[var(--beat-accent)]/10 text-white'
                          : 'border-white/[0.08] text-white/55 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="min-w-0 truncate">AI Take {index + 1} · {take.prompt}</span>
                      {selectedClip.activeTakeId === take.id ? <span>✓</span> : null}
                    </button>
                  ))}
                  {selectedClip.activeTakeId ? (
                    <button
                      type="button"
                      onClick={() => activateTake(null)}
                      className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-white/45 hover:text-white"
                    >
                      <RotateCcw className="size-3" />
                      {t('redo.rollback')}
                    </button>
                  ) : null}
                </div>
              </aside>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/[0.07] bg-[#151618]">
            <div className="flex h-12 items-center justify-center gap-3 border-b border-white/[0.07] px-4">
              <span className="w-16 text-right text-[11px] font-[520] tabular-nums tracking-[-0.01em] text-white/48">
                {formatTime(timelineCurrentTime)}
              </span>
              <button
                type="button"
                onClick={() => void togglePlayback()}
                disabled={!selectedClip || selectedClip.sourceType === 'audio'}
                className="inline-flex size-8 items-center justify-center rounded-full bg-white text-black shadow-[0_5px_18px_rgba(0,0,0,0.28)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={isPlaying ? t('actions.pause') : t('actions.play')}
                title={`${isPlaying ? t('actions.pause') : t('actions.play')} · Space`}
              >
                {isPlaying ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="ml-0.5 size-4 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={splitAtPlayhead}
                disabled={
                  !selectedClip ||
                  selectedClip.sourceType !== 'video' ||
                  Boolean(selectedClip.activeTakeId) ||
                  currentTime <= selectedClip.inPoint + MIN_CLIP_DURATION ||
                  currentTime >= selectedClip.outPoint - MIN_CLIP_DURATION
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-[520] text-white/62 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title={`${t('actions.split')} · ⌘/Ctrl+B`}
              >
                <Scissors className="size-3.5" />
                {t('actions.split')}
                <kbd className="hidden rounded bg-white/[0.055] px-1 py-0.5 text-[9px] font-[520] text-white/35 sm:inline">
                  ⌘B
                </kbd>
              </button>
              <span className="w-16 text-[11px] font-[520] tabular-nums tracking-[-0.01em] text-white/48">
                {formatTime(document.duration)}
              </span>
            </div>

            {selectedClip && displayedSelectedClip ? (
              <div className="border-b border-white/[0.07] px-3 py-2 lg:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.055] text-white/62">
                    {selectedClip.sourceType === 'image' ? (
                      <ImageIcon className="size-4" />
                    ) : selectedClip.sourceType === 'video' ? (
                      <FileVideo2 className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-[560] tracking-[-0.01em] text-white/88">
                      {selectedClip.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-[500] text-white/38">
                      {t(`clipInspector.type.${selectedClip.sourceType}`)} ·{' '}
                      {displayedSelectedClip.duration.toFixed(2)}s
                    </span>
                  </span>
                  <span className="ml-2 hidden min-w-0 flex-1 text-[10px] font-[500] text-white/30 md:block">
                    {t('timeline.dragHint')}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExactControlsOpen((value) => !value)}
                      aria-expanded={exactControlsOpen}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-[520] transition ${
                        exactControlsOpen
                          ? 'border-white/18 bg-white/[0.08] text-white/80'
                          : 'border-white/10 text-white/42 hover:bg-white/[0.05] hover:text-white/75'
                      }`}
                    >
                      <SlidersHorizontal className="size-3" />
                      {t('clipInspector.exactControls')}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSelectedClip(false)}
                      title={`${t('timeline.delete')} · Delete`}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/42 transition hover:border-red-400/25 hover:bg-red-400/10 hover:text-red-100"
                      aria-label={t('timeline.delete')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSelectedClip(true)}
                      className="inline-flex h-8 items-center rounded-lg border border-white/10 px-2.5 text-[10px] font-[520] text-white/42 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      {t('timeline.rippleDelete')}
                    </button>
                  </div>
                </div>

                {exactControlsOpen ? (
                  <div className="mt-2 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2">
                    <div>
                      <p className="mb-1 text-[9px] font-[520] text-white/32">
                        {selectedClip.sourceType === 'video'
                          ? t('clipInspector.sourceRange')
                          : selectedClip.sourceType === 'image'
                            ? t('clipInspector.stillDuration')
                            : t('clipInspector.clipDuration')}
                      </p>
                      {selectedClip.sourceType === 'video' && !selectedClip.activeTakeId ? (
                        <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={selectedClip.outPoint - MIN_CLIP_DURATION}
                        step={0.01}
                        value={Number(selectedClip.inPoint.toFixed(2))}
                        onChange={(event) =>
                          updateTrim('in', Number(event.target.value))
                        }
                        className="h-7 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-[520] tabular-nums text-white/82 outline-none transition focus:border-[var(--beat-accent)]/55"
                        aria-label={t('clipInspector.sourceFrom')}
                      />
                      <span className="text-[10px] text-white/28">→</span>
                      <input
                        type="number"
                        min={selectedClip.inPoint + MIN_CLIP_DURATION}
                        max={selectedClip.sourceDuration}
                        step={0.01}
                        value={Number(selectedClip.outPoint.toFixed(2))}
                        onChange={(event) =>
                          updateTrim('out', Number(event.target.value))
                        }
                        className="h-7 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-[520] tabular-nums text-white/82 outline-none transition focus:border-[var(--beat-accent)]/55"
                        aria-label={t('clipInspector.sourceTo')}
                      />
                        </div>
                      ) : selectedClip.sourceType === 'image' ? (
                        <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={MIN_CLIP_DURATION}
                        step={0.1}
                        value={Number(selectedClip.duration.toFixed(2))}
                        onChange={(event) =>
                          resizeSelectedImage(Number(event.target.value))
                        }
                        className="h-7 w-24 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-[520] tabular-nums text-white/82 outline-none transition focus:border-[var(--beat-accent)]/55"
                        aria-label={t('clipInspector.stillDuration')}
                      />
                      <span className="text-[10px] text-white/35">s</span>
                        </div>
                      ) : (
                        <p className="text-[11px] font-[520] tabular-nums text-white/72">
                          {selectedClip.duration.toFixed(2)}s
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 text-[9px] font-[520] text-white/32">
                        {t('clipInspector.timelinePosition')}
                      </p>
                      <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={Number(selectedClip.startTime.toFixed(2))}
                      onChange={(event) =>
                        moveSelectedClip(Number(event.target.value))
                      }
                      className="h-7 w-24 rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] font-[520] tabular-nums text-white/82 outline-none transition focus:border-[var(--beat-accent)]/55"
                      aria-label={t('clipInspector.timelinePosition')}
                    />
                    <span className="text-[10px] text-white/35">s</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedClip?.sourceType === 'audio' ? (
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 border-b border-white/[0.07] px-4 py-2.5">
                <label className="text-[10px] font-[520] text-white/40">
                  {t('audio.volume')}
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={Math.min(1, selectedClip.volume)}
                  onChange={(event) =>
                    commitDocument((current) =>
                      applyEditorOperations(current, [
                        {
                          type: 'update_audio',
                          clipId: selectedClip.id,
                          patch: { volume: Number(event.target.value) },
                        },
                      ]).document
                    )
                  }
                  className="h-1 w-full accent-[var(--beat-graph)]"
                  aria-label={t('audio.volume')}
                />
                <span className="w-12 text-right text-[11px] font-[520] tabular-nums text-white/58">
                  {Math.round(Math.min(1, selectedClip.volume) * 100)}%
                </span>

                <label className="text-[10px] font-[520] text-white/40">
                  {t('audio.fadeIn')}
                </label>
                <input
                  type="range"
                  min={0}
                  max={selectedClip.duration}
                  step={0.01}
                  value={selectedClip.fadeIn}
                  onChange={(event) =>
                    commitDocument((current) =>
                      applyEditorOperations(current, [
                        {
                          type: 'update_audio',
                          clipId: selectedClip.id,
                          patch: { fadeIn: Number(event.target.value) },
                        },
                      ]).document
                    )
                  }
                  className="h-1 w-full accent-[var(--beat-graph)]"
                  aria-label={t('audio.fadeIn')}
                />
                <span className="w-12 text-right text-[11px] font-[520] tabular-nums text-white/58">
                  {selectedClip.fadeIn.toFixed(2)}s
                </span>

                <label className="text-[10px] font-[520] text-white/40">
                  {t('audio.fadeOut')}
                </label>
                <input
                  type="range"
                  min={0}
                  max={selectedClip.duration}
                  step={0.01}
                  value={selectedClip.fadeOut}
                  onChange={(event) =>
                    commitDocument((current) =>
                      applyEditorOperations(current, [
                        {
                          type: 'update_audio',
                          clipId: selectedClip.id,
                          patch: { fadeOut: Number(event.target.value) },
                        },
                      ]).document
                    )
                  }
                  className="h-1 w-full accent-[var(--beat-graph)]"
                  aria-label={t('audio.fadeOut')}
                />
                <button
                  type="button"
                  onClick={() =>
                    commitDocument((current) =>
                      applyEditorOperations(current, [
                        {
                          type: 'update_audio',
                          clipId: selectedClip.id,
                          patch: { muted: !selectedClip.muted },
                        },
                      ]).document
                    )
                  }
                  className={`h-7 rounded-md border px-2 text-[10px] transition ${
                    selectedClip.muted
                      ? 'border-red-400/25 bg-red-400/10 text-red-100'
                      : 'border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {selectedClip.muted ? t('audio.unmute') : t('audio.mute')}
                </button>
              </div>
            ) : null}

            <div className="max-h-56 min-h-44 overflow-auto">
              <div className="grid min-w-[760px] grid-cols-[128px_1fr]">
                <div className="flex h-8 items-center border-b border-r border-white/[0.07] px-3 text-[10px] font-[540] tracking-[-0.01em] text-white/36">
                  {t('timeline.title')}
                </div>
                <button
                  type="button"
                  aria-label={t('timeline.seek')}
                  title={t('timeline.seekHint')}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    seekTimeline(
                      timelineTimeFromClientX({
                        clientX: event.clientX,
                        left: rect.left,
                        width: rect.width,
                        duration: timelineDisplayDuration,
                      })
                    );
                  }}
                  className="relative h-8 border-b border-white/[0.07] bg-black/[0.08] text-left"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((point) => (
                    <span
                      key={point}
                      className="absolute top-2 text-[9px] font-[500] tabular-nums tracking-[-0.01em] text-white/28"
                      style={{ left: `${point * 100}%` }}
                    >
                      {formatTime(timelineDisplayDuration * point)}
                    </span>
                  ))}
                  <span
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[var(--beat-accent)]/85 shadow-[0_0_8px_rgba(255,103,0,0.4)]"
                    style={{
                      left: `${
                        (timelineCurrentTime / timelineDisplayDuration) * 100
                      }%`,
                    }}
                  />
                </button>
                {document.tracks.map((track) => (
                  <div key={track.id} className="contents">
                    <div className="flex h-16 items-center gap-2.5 border-b border-r border-white/[0.07] px-3 text-[11px] font-[520] text-white/55">
                      {track.kind === 'audio' ? (
                        <Volume2 className="size-3.5" />
                      ) : (
                        <FileVideo2 className="size-3.5" />
                      )}
                      {track.kind === 'audio'
                        ? t('timeline.audioTrack')
                        : t('timeline.visualTrack')}
                    </div>
                    <div
                      data-timeline-track
                      className="relative h-16 cursor-text border-b border-white/[0.07] bg-white/[0.012]"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        seekTimeline(
                          timelineTimeFromClientX({
                            clientX: event.clientX,
                            left: rect.left,
                            width: rect.width,
                            duration: timelineDisplayDuration,
                          })
                        );
                      }}
                    >
                      {track.clips.map((clip) => {
                        const displayedClip =
                          timelineDragPreview?.id === clip.id
                            ? { ...clip, ...timelineDragPreview }
                            : clip;
                        return (
                          <TimelineClipBlock
                            key={clip.id}
                            clip={displayedClip}
                            totalDuration={timelineDisplayDuration}
                            selected={selectedClipId === clip.id}
                            onSelect={() => selectClip(clip)}
                            onPointerAction={(mode, event) =>
                              beginTimelineDrag(clip, mode, event)
                            }
                            trimStartLabel={t('timeline.trimStart')}
                            trimEndLabel={t('timeline.trimEnd')}
                          />
                        );
                      })}
                      {selectedClip &&
                      (track.kind === selectedClip.sourceType ||
                        (track.kind === 'video' &&
                          selectedClip.sourceType === 'image')) ? (
                        <span
                          className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                          style={{
                            left: `${
                              (timelineCurrentTime / timelineDisplayDuration) *
                              100
                            }%`,
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {error ? (
        <div className="absolute bottom-4 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-xl border border-red-400/25 bg-red-950/90 px-4 py-3 text-xs text-red-100 shadow-2xl backdrop-blur">
          {error}
        </div>
      ) : null}
    </div>
  );
}
