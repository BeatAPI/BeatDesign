'use client';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';
import { ArrowUp, Loader2, RotateCw, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import {
  stopComposerEvent,
  stopComposerKeyboardEvent,
} from './beatcanvas-composer-utils';
import {
  composerCardClassName,
  composerGenerateButtonClassName,
} from '@/components/app/composer-styles';
import type {
  CanvasLabels,
  BeatCanvasComposerPresentation,
} from './beatcanvas-front-layer-context';

export function BeatCanvasComposerShell({
  activeDraftCard,
  children,
  composerRef,
  isDraftBusy,
  isPromptComposing,
  labels,
  onActiveComposerCardIdChange,
  onPromptChange,
  onPromptCommit,
  onGenerateDraft,
  onPromptCompositionChange,
  promptCharacterCount,
  promptCharacterLimit,
  promptInputValue,
  promptPlaceholder,
  presentation,
  promptAccessory,
  position,
  takeCount = 0,
}: {
  activeDraftCard: CanvasGenerationCard;
  children: ReactNode;
  composerRef: RefObject<HTMLElement | null>;
  isDraftBusy: boolean;
  isPromptComposing: boolean;
  labels: CanvasLabels;
  onActiveComposerCardIdChange: (cardId: string | null) => void;
  onPromptChange: (nextPrompt: string) => void;
  onPromptCommit: (nextPrompt: string) => void;
  onGenerateDraft: (draftId: string) => void;
  onPromptCompositionChange: (composing: boolean) => void;
  promptCharacterCount: number;
  promptCharacterLimit: number;
  promptInputValue: string;
  promptPlaceholder: string;
  presentation?: BeatCanvasComposerPresentation | null;
  promptAccessory?: ReactNode;
  position?: { left: number; top: number } | null;
  takeCount?: number;
}) {
  const hasExistingTakes = takeCount > 0;
  const primaryButtonLabel = isDraftBusy
    ? labels.generatingLabel
    : hasExistingTakes
      ? labels.regenerateLabel
      : labels.generateLabel;
  const isPrimaryDisabled = isDraftBusy || isPromptComposing;

  return (
    <section
      ref={composerRef}
      className={cn(
        'beat-composer pointer-events-auto absolute z-[60] isolate',
        composerCardClassName,
        'w-[min(560px,calc(100vw-32px))]',
        position ? '' : 'bottom-[98px] left-1/2 -translate-x-1/2'
      )}
      style={position ? { left: position.left, top: position.top } : undefined}
      onPointerDown={stopComposerEvent}
      onPointerDownCapture={stopComposerEvent}
      onKeyDownCapture={stopComposerKeyboardEvent}
      onKeyUpCapture={stopComposerKeyboardEvent}
    >
      {/* ── Header row ── */}
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          'px-3.5 pt-3'
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div suppressHydrationWarning className="min-w-0 flex-1">
            {promptAccessory ? (
              <div
                data-composer-reference-row
                className="mb-1.5 flex min-h-7 items-center pl-2"
              >
                {promptAccessory}
              </div>
            ) : null}
            <Textarea
              value={promptInputValue}
              onChange={(event) => onPromptChange(event.target.value)}
              onCompositionStart={() => {
                onPromptCompositionChange(true);
              }}
              onCompositionEnd={(event) => {
                if (!activeDraftCard || isDraftBusy) {
                  return;
                }

                onPromptCompositionChange(false);
                onPromptCommit(event.currentTarget.value);
              }}
              placeholder={promptPlaceholder}
              readOnly={isDraftBusy}
              className="min-h-[56px] max-h-[180px] resize-none overflow-y-auto border-0 bg-transparent pl-2 pr-0 py-0 text-[14px] font-medium leading-[1.6] shadow-none outline-none placeholder:text-[14px] placeholder:font-normal focus:border-transparent focus:outline-none"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <span
              className={cn(
                'text-[10px] font-medium tabular-nums',
                promptCharacterCount >= promptCharacterLimit
                  ? 'text-[var(--beatcanvas-warning)]'
                  : 'text-[var(--beat-text-3)]'
              )}
            >
              {promptCharacterCount}/{promptCharacterLimit}
            </span>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-lg text-[var(--beat-text-3)] transition hover:bg-white/10 hover:text-white"
              onClick={() => onActiveComposerCardIdChange(null)}
              aria-label={labels.closeComposerLabel}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer: options + CTA ── */}
      <div className="px-3.5 pb-3 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">{children}</div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onGenerateDraft(activeDraftCard.id);
              }}
              disabled={isPrimaryDisabled}
              aria-label={primaryButtonLabel}
              className={cn(
                composerGenerateButtonClassName,
                'relative active:translate-y-px'
              )}
            >
              {isDraftBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : hasExistingTakes ? (
                <RotateCw className="size-3.5" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
              {hasExistingTakes ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--beat-surface-2)] px-1 text-[9px] font-bold tabular-nums text-[var(--beat-text-1)] ring-1 ring-white/12">
                  {takeCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
