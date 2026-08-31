import { cn } from '@/lib/utils';
import { Download, DownloadIcon, Eye, Film, Sparkles } from 'lucide-react';

import { beatcanvasPanelClassName } from './beatcanvas-theme';

export function BeatCanvasContextToolbar({
  canDownload,
  canPreview,
  downloadLabel,
  isBatchDownload = false,
  previewLabel,
  onDownload,
  onPreview,
  addToTimelineLabel,
  canAddToTimeline = false,
  onAddToTimeline,
  continueVideoLabel,
  canContinueVideo = false,
  onContinueVideo,
}: {
  canDownload: boolean;
  canPreview: boolean;
  downloadLabel: string | null;
  isBatchDownload?: boolean;
  previewLabel: string | null;
  onDownload: () => void;
  onPreview: () => void;
  addToTimelineLabel?: string | null;
  canAddToTimeline?: boolean;
  onAddToTimeline?: () => void;
  continueVideoLabel?: string | null;
  canContinueVideo?: boolean;
  onContinueVideo?: () => void;
}) {
  const actionClassName =
    'inline-flex h-8 items-center gap-1.5 rounded-[11px] px-2.5 text-[12px] font-semibold text-[var(--beatcanvas-ink-soft)] transition-all duration-150 hover:bg-black/[0.045] hover:text-[var(--beatcanvas-ink)]';

  return (
    <section
      className={cn(
        'pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-[20px] px-2 py-1.5',
        beatcanvasPanelClassName
      )}
    >
      {downloadLabel ? (
        <button
          type="button"
          className={cn(actionClassName, !canDownload && 'opacity-45')}
          onClick={onDownload}
          disabled={!canDownload}
        >
          {isBatchDownload ? (
            <DownloadIcon className="size-4" strokeWidth={2.1} />
          ) : (
            <Download className="size-4" strokeWidth={2.1} />
          )}
          <span>{downloadLabel}</span>
        </button>
      ) : null}
      {previewLabel ? (
        <button
          type="button"
          className={cn(actionClassName, !canPreview && 'opacity-45')}
          onClick={onPreview}
          disabled={!canPreview}
        >
          <Eye className="size-4" strokeWidth={2.1} />
          <span>{previewLabel}</span>
        </button>
      ) : null}
      {continueVideoLabel ? (
        <button
          type="button"
          className={cn(actionClassName, !canContinueVideo && 'opacity-45')}
          onClick={onContinueVideo}
          disabled={!canContinueVideo}
        >
          <Sparkles className="size-4" strokeWidth={2.1} />
          <span>{continueVideoLabel}</span>
        </button>
      ) : null}
      {addToTimelineLabel ? (
        <button
          type="button"
          className={cn(actionClassName, !canAddToTimeline && 'opacity-45')}
          onClick={onAddToTimeline}
          disabled={!canAddToTimeline}
        >
          <Film className="size-4" strokeWidth={2.1} />
          <span>{addToTimelineLabel}</span>
        </button>
      ) : null}
    </section>
  );
}
