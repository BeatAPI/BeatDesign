import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';
import {
  filterCanvasReferenceMentions,
  findActiveCanvasReferenceMention,
  insertCanvasReferenceMention,
  type ActiveCanvasReferenceMention,
  type CanvasReferenceMention,
} from '@/core/beatcanvas/reference-mentions';
import { ArrowUp, Image, Loader2, Video, X } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';

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
  primaryButtonLabel: primaryButtonLabelOverride,
  promptCharacterCount,
  promptCharacterLimit,
  promptInputValue,
  promptPlaceholder,
  presentation,
  promptAccessory,
  promptReferences = [],
  position,
  takeCount: _takeCount = 0,
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
  primaryButtonLabel?: string;
  promptCharacterCount: number;
  promptCharacterLimit: number;
  promptInputValue: string;
  promptPlaceholder: string;
  presentation?: BeatCanvasComposerPresentation | null;
  promptAccessory?:
    | ReactNode
    | ((insertReferenceMention: (alias: string) => void) => ReactNode);
  promptReferences?: Array<
    CanvasReferenceMention & { thumbnailUrl: string | null }
  >;
  position?: { left: number; top: number } | null;
  takeCount?: number;
}) {
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeMention, setActiveMention] =
    useState<ActiveCanvasReferenceMention | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const primaryButtonLabel =
    primaryButtonLabelOverride ??
    (isDraftBusy ? labels.generatingLabel : labels.generateLabel);
  const isPrimaryDisabled = isDraftBusy || isPromptComposing;
  const mentionOptions = activeMention
    ? filterCanvasReferenceMentions({
        mentions: promptReferences,
        query: activeMention.query,
      })
    : [];

  const selectReferenceMention = (
    alias: string,
    mentionOverride?: ActiveCanvasReferenceMention | null
  ) => {
    const input = promptInputRef.current;
    const selectionStart = input?.selectionStart ?? promptInputValue.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const result = insertCanvasReferenceMention({
      prompt: promptInputValue,
      alias,
      selectionStart,
      selectionEnd,
      activeMention: mentionOverride ?? activeMention,
    });

    onPromptChange(result.prompt);
    setActiveMention(null);
    setSelectedMentionIndex(0);
    window.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.setSelectionRange(result.caret, result.caret);
    });
  };

  const renderedPromptAccessory =
    typeof promptAccessory === 'function'
      ? promptAccessory((alias) => selectReferenceMention(alias, null))
      : promptAccessory;

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
            {renderedPromptAccessory ? (
              <div
                data-composer-reference-row
                className="mb-1.5 flex min-h-7 min-w-0 items-center pl-2"
              >
                {renderedPromptAccessory}
              </div>
            ) : null}
            <div className="relative">
              <Textarea
                ref={promptInputRef}
                value={promptInputValue}
                onChange={(event) => {
                  const nextPrompt = event.target.value;
                  onPromptChange(nextPrompt);
                  setActiveMention(
                    findActiveCanvasReferenceMention({
                      prompt: nextPrompt,
                      caret: event.target.selectionStart ?? nextPrompt.length,
                    })
                  );
                  setSelectedMentionIndex(0);
                }}
                onClick={(event) => {
                  setActiveMention(
                    findActiveCanvasReferenceMention({
                      prompt: event.currentTarget.value,
                      caret:
                        event.currentTarget.selectionStart ??
                        event.currentTarget.value.length,
                    })
                  );
                }}
                onKeyDown={(event) => {
                  if (!activeMention || mentionOptions.length === 0) return;

                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const direction = event.key === 'ArrowDown' ? 1 : -1;
                    setSelectedMentionIndex((current) =>
                      (current + direction + mentionOptions.length) %
                      mentionOptions.length
                    );
                    return;
                  }

                  if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault();
                    const mention = mentionOptions[selectedMentionIndex];
                    if (mention) {
                      selectReferenceMention(mention.alias, activeMention);
                    }
                    return;
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setActiveMention(null);
                  }
                }}
                onBlur={() => {
                  window.requestAnimationFrame(() => setActiveMention(null));
                }}
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

              {activeMention && mentionOptions.length > 0 ? (
                <div className="beat-pop-in absolute left-2 top-full z-50 mt-1.5 w-[min(340px,calc(100vw-72px))] overflow-hidden rounded-xl border border-white/10 bg-[var(--beat-surface-2)] p-1.5 shadow-[0_22px_54px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {mentionOptions.slice(0, 8).map((mention, index) => {
                    const reference = promptReferences.find(
                      (item) => item.cardId === mention.cardId
                    );
                    return (
                      <button
                        key={mention.cardId}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          selectReferenceMention(mention.alias, activeMention)
                        }
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition',
                          index === selectedMentionIndex
                            ? 'bg-white/[0.09] text-white'
                            : 'text-[var(--beat-text-2)] hover:bg-white/[0.06] hover:text-white'
                        )}
                      >
                        <span className="relative inline-flex size-8 shrink-0 overflow-hidden rounded-md bg-black/45">
                          {reference?.thumbnailUrl && mention.type === 'video' ? (
                            <video
                              src={reference.thumbnailUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="size-full object-cover"
                            />
                          ) : reference?.thumbnailUrl ? (
                            <img
                              src={reference.thumbnailUrl}
                              alt=""
                              draggable={false}
                              className="size-full object-cover"
                            />
                          ) : mention.type === 'video' ? (
                            <Video className="m-auto size-3.5" />
                          ) : (
                            <Image className="m-auto size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-[11px] font-semibold text-[var(--beat-graph)]">
                            {mention.alias}
                          </span>
                          <span className="block truncate text-[12px] font-medium">
                            {mention.name}
                          </span>
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/30">
                          {mention.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
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
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
