'use client';

import { cn } from '@/lib/utils';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';
import { ChevronDown, ImagePlus, Video, X } from 'lucide-react';
import type { RefObject } from 'react';

import {
  composerFloatingPanelClassName,
  composerSectionLabelClassName,
  getComposerOptionRowClassName,
  stopComposerEvent,
} from './beatcanvas-composer-utils';
import type { CanvasLabels } from './beatcanvas-front-layer-context';

type ReferenceOption = {
  intent: CanvasGenerationCard['type'];
  remaining: number | null;
};

export type CanvasReferenceCardOption = {
  id: string;
  name: string;
  type: CanvasGenerationCard['type'];
  thumbnailUrl: string | null;
};

export function BeatCanvasComposerReferencePicker({
  activeDraftId,
  canvasReferenceCards = [],
  containerRef,
  currentReferenceCards = [],
  isDraftBusy,
  isOpen,
  labels,
  onAttachCanvasReference = () => {},
  onOpenChange,
  onOpenReferencePicker,
  onRemoveCanvasReference = () => {},
  options,
  primaryIntent,
  variant = 'icon',
}: {
  activeDraftId: string;
  canvasReferenceCards?: CanvasReferenceCardOption[];
  containerRef?: RefObject<HTMLDivElement | null>;
  currentReferenceCards?: CanvasReferenceCardOption[];
  isDraftBusy: boolean;
  isOpen: boolean;
  labels: CanvasLabels;
  onAttachCanvasReference?: (draftId: string, cardId: string) => void;
  onOpenChange: (nextOpen: boolean) => void;
  onOpenReferencePicker: (
    draftId: string,
    intent: CanvasGenerationCard['type']
  ) => void;
  onRemoveCanvasReference?: (draftId: string, cardId: string) => void;
  options: ReferenceOption[];
  primaryIntent: CanvasGenerationCard['type'];
  variant?: 'icon' | 'row';
}) {
  const isRow = variant === 'row';
  const primaryLabel =
    primaryIntent === 'video'
      ? labels.uploadVideoLabel
      : labels.uploadImageLabel;
  const attachedCount = currentReferenceCards.length;

  return (
    <div
      ref={containerRef}
      className={cn('relative shrink-0', isRow && 'inline-flex')}
    >
      <button
        type="button"
        disabled={isDraftBusy || options.length === 0}
        onClick={() => {
          onOpenChange(!isOpen);
        }}
        onPointerDownCapture={stopComposerEvent}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center text-[var(--beat-text-3)] transition-all duration-200 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60',
          isRow
            ? 'h-7 w-7 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.025]'
            : 'h-8 w-8 rounded-lg'
        )}
        aria-label={primaryLabel}
        aria-expanded={isOpen}
      >
        {primaryIntent === 'video' ? (
          <Video className="size-4" />
        ) : (
          <ImagePlus className="size-4" />
        )}
        {attachedCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--beat-graph)] px-1 text-[9px] font-bold leading-none text-white">
            {attachedCount}
          </span>
        ) : null}
        {!isRow && options.length > 1 ? (
          <ChevronDown
            className={cn(
              'pointer-events-none size-3 text-[var(--beatcanvas-ink-faint)] transition-transform duration-200',
              'absolute bottom-2 right-2',
              isOpen ? 'rotate-180' : ''
            )}
          />
        ) : null}
      </button>

      {isOpen ? (
        <div
          className={cn(
            composerFloatingPanelClassName,
            'left-0 w-[min(300px,calc(100vw-48px))]'
          )}
          onPointerDownCapture={stopComposerEvent}
        >
          <div className="max-h-[320px] space-y-2.5 overflow-y-auto">
            <div className="space-y-0.5">
              {options.map((option) => (
                <button
                  key={option.intent}
                  type="button"
                  disabled={isDraftBusy}
                  onClick={() => {
                    onOpenReferencePicker(activeDraftId, option.intent);
                    onOpenChange(false);
                  }}
                  className={cn(
                    getComposerOptionRowClassName(false),
                    'justify-between disabled:cursor-not-allowed disabled:opacity-60'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {option.intent === 'video' ? (
                      <Video className="size-3.5 text-[var(--beat-text-2)]" />
                    ) : (
                      <ImagePlus className="size-3.5 text-[var(--beat-text-2)]" />
                    )}
                    <span>
                      {option.intent === 'video'
                        ? labels.uploadVideoLabel
                        : labels.uploadImageLabel}
                    </span>
                  </span>
                  {option.remaining !== null ? (
                    <span className="text-[11px] font-medium tabular-nums text-[var(--beat-text-3)]">
                      {option.remaining}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {attachedCount > 0 ? (
              <div className="space-y-1.5">
                <div className={cn(composerSectionLabelClassName, 'px-2')}>
                  {labels.currentReferencesLabel}
                </div>
                {currentReferenceCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-[var(--beat-text-1)]">
                      {card.thumbnailUrl ? (
                        <img
                          src={card.thumbnailUrl}
                          alt=""
                          draggable={false}
                          className="size-8 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[var(--beat-text-2)]">
                          {card.type === 'video' ? (
                            <Video className="size-3.5" />
                          ) : (
                            <ImagePlus className="size-3.5" />
                          )}
                        </span>
                      )}
                      <span className="truncate text-[13px] font-medium">
                        {card.name}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() => {
                        onRemoveCanvasReference(activeDraftId, card.id);
                      }}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--beat-text-3)] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={labels.removeReferenceLabel}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className={cn(composerSectionLabelClassName, 'px-2')}>
                {labels.fromCanvasLabel}
              </div>
              {canvasReferenceCards.length === 0 ? (
                <div className="px-2.5 pb-1 text-xs text-[var(--beat-text-3)]">
                  {labels.noCanvasReferencesLabel}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 px-2.5 pb-1">
                  {canvasReferenceCards.slice(0, 8).map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() => {
                        onAttachCanvasReference(activeDraftId, card.id);
                      }}
                      title={card.name}
                      className="relative aspect-square overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-[var(--beat-graph)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {card.thumbnailUrl ? (
                        <img
                          src={card.thumbnailUrl}
                          alt={card.name}
                          draggable={false}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="inline-flex size-full items-center justify-center text-[var(--beat-text-3)]">
                          {card.type === 'video' ? (
                            <Video className="size-4" />
                          ) : (
                            <ImagePlus className="size-4" />
                          )}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
