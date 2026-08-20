'use client';

import { cn } from '@/lib/utils';
import type { CanvasOutputCard } from '@/core/beatcanvas/canvas-types';
import { History } from 'lucide-react';
import type { RefObject } from 'react';

import {
  composerFloatingPanelClassName,
  composerSectionLabelClassName,
  stopComposerEvent,
} from './beatcanvas-composer-utils';
import type { CanvasLabels } from './beatcanvas-front-layer-context';

export function BeatCanvasComposerVersionPicker({
  activeDraftId,
  containerRef,
  isDraftBusy,
  isOpen,
  labels,
  onOpenChange,
  onPinGenerationOutput,
  outputs,
  pinnedOutputId,
}: {
  activeDraftId: string;
  containerRef?: RefObject<HTMLDivElement | null>;
  isDraftBusy: boolean;
  isOpen: boolean;
  labels: CanvasLabels;
  onOpenChange: (nextOpen: boolean) => void;
  onPinGenerationOutput: (draftId: string, outputId: string) => void;
  outputs: CanvasOutputCard[];
  pinnedOutputId: string | null;
}) {
  if (outputs.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
    >
      <button
        type="button"
        disabled={isDraftBusy}
        onClick={() => {
          onOpenChange(!isOpen);
        }}
        onPointerDownCapture={stopComposerEvent}
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[var(--beat-text-3)] transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={labels.historyLabel}
        aria-expanded={isOpen}
      >
        <History className="size-3.5" />
        <span>{outputs.length}</span>
      </button>

      {isOpen ? (
        <div
          className={cn(
            composerFloatingPanelClassName,
            'right-0 w-[min(280px,calc(100vw-48px))]'
          )}
          onPointerDownCapture={stopComposerEvent}
        >
          <div className={cn(composerSectionLabelClassName, 'px-2 pb-1.5')}>
            {labels.historyLabel}
          </div>
          <div className="max-h-[280px] space-y-1 overflow-y-auto">
            {outputs.map((output, index) => {
              const isActive = output.id === pinnedOutputId;
              return (
                <button
                  key={output.id}
                  type="button"
                  disabled={isDraftBusy || !output.url}
                  onClick={() => {
                    onPinGenerationOutput(activeDraftId, output.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150',
                    isActive
                      ? 'bg-white/[0.08]'
                      : 'hover:bg-white/[0.05]',
                    !output.url && 'opacity-60'
                  )}
                >
                  {output.url && output.type === 'image' ? (
                    <img
                      src={output.url}
                      alt=""
                      draggable={false}
                      className="size-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-semibold text-[var(--beat-text-3)]">
                      {outputs.length - index}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--beat-text-1)]">
                      {index === 0
                        ? labels.latestResultLabel
                        : `${labels.historyLabel} ${outputs.length - index}`}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--beat-text-3)]">
                      {output.status === 'succeeded'
                        ? labels.readyStatusLabel
                        : output.status === 'failed'
                          ? labels.failedStatusLabel
                          : labels.generatingStatusLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
