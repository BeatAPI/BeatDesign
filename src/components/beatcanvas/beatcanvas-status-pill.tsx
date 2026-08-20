'use client';

import { cn } from '@/lib/utils';
import { AlertCircle, Sparkles } from 'lucide-react';
import { beatcanvasPanelClassName } from './beatcanvas-theme';

export function BeatCanvasStatusPill({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  return (
    <section
      className={`pointer-events-auto absolute left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm ${beatcanvasPanelClassName}`}
    >
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-full',
          isError
            ? 'bg-[rgba(255,107,115,0.14)] text-[var(--beatcanvas-error)]'
            : 'bg-[var(--beat-graph-soft)] text-[var(--beat-graph)]'
        )}
      >
        {isError ? (
          <AlertCircle className="size-3.5" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
      </span>
      <span
        className={cn(
          'font-medium',
          isError
            ? 'text-[var(--beatcanvas-error)]'
            : 'text-[var(--beat-text-2)]'
        )}
      >
        {message}
      </span>
    </section>
  );
}
