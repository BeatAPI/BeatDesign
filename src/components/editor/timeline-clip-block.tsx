import { FileVideo2, ImageIcon, Volume2 } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TimelineClip } from '@/core/editor/timeline-document';
import type { TimelineDragMode } from '@/core/editor/timeline-interaction';

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(2).padStart(5, '0')}`;
};

export function TimelineClipBlock({
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
            : clip.sourceType === 'caption'
              ? 'cursor-grab border-white/16 bg-[#1d2430] hover:border-white/28 hover:bg-[#232b38] active:cursor-grabbing'
            : 'cursor-grab border-white/12 bg-[#202124] hover:border-white/24 hover:bg-[#242529] active:cursor-grabbing'
      }`}
      style={{ left: `${left}%`, width: `${Math.max(width, 1.2)}%` }}
      title={
        clip.sourceType === 'caption'
          ? clip.text || clip.name
          : clip.sourceType === 'image'
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
              const video = event.currentTarget;
              const previewOffset = Math.min(
                1,
                Math.max(0, clip.outPoint - clip.inPoint - 0.05)
              );
              video.currentTime = clip.inPoint + previewOffset;
            }}
            className="absolute inset-0 size-full object-cover opacity-28 transition group-hover:opacity-38"
          />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/38 to-black/10" />
        <span className="relative flex h-full min-w-0 flex-col justify-between px-2.5 py-2">
          <span className="block truncate text-[11px] font-[560] tracking-[-0.01em] text-white/95">
            {clip.sourceType === 'caption' ? clip.text || clip.name : clip.name}
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
