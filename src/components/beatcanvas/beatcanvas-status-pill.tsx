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
      className={`pointer-events-auto absolute left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm ${beatcanvasPanelClassName}`}
    >
      {isError ? (
        <AlertCircle className="size-3.5 text-[var(--beatcanvas-error)]" />
      ) : (
        <Sparkles className="size-3.5 text-[var(--beat-accent)]" />
      )}
      <span
        className={cn(
          'beat-product-display text-[13px] font-medium tracking-[-0.02em]',
          isError
            ? 'text-[var(--beatcanvas-error)]'
            : 'text-[var(--beat-accent)]'
        )}
      >
        {message}
      </span>
    </section>
  );
}
