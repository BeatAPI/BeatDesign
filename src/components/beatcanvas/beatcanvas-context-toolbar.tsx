'use client';

import { cn } from '@/lib/utils';
import { Download, DownloadIcon, Eye } from 'lucide-react';

import { beatcanvasPanelClassName } from './beatcanvas-theme';

export function BeatCanvasContextToolbar({
  canDownload,
  canPreview,
  downloadLabel,
  isBatchDownload = false,
  previewLabel,
  onDownload,
  onPreview,
}: {
  canDownload: boolean;
  canPreview: boolean;
  downloadLabel: string | null;
  isBatchDownload?: boolean;
  previewLabel: string | null;
  onDownload: () => void;
  onPreview: () => void;
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
    </section>
  );
}
