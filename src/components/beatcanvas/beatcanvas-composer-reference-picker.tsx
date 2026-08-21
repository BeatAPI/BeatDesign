'use client';

import { cn } from '@/lib/utils';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';
import { ChevronDown, GripVertical, ImagePlus, Video, X } from 'lucide-react';
import { useState, type RefObject } from 'react';

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
  alias?: string;
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
  onInsertReferenceMention = () => {},
  onReorderCanvasReferences = () => {},
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
  onInsertReferenceMention?: (alias: string) => void;
  onReorderCanvasReferences?: (
    draftId: string,
    activeCardId: string,
    overCardId: string
  ) => void;
  onRemoveCanvasReference?: (draftId: string, cardId: string) => void;
  options: ReferenceOption[];
  primaryIntent: CanvasGenerationCard['type'];
  variant?: 'icon' | 'row';
}) {
  const [draggedReferenceId, setDraggedReferenceId] = useState<string | null>(
    null
  );
  const isRow = variant === 'row';
  const primaryLabel =
    primaryIntent === 'video'
      ? labels.uploadVideoLabel
      : labels.uploadImageLabel;
  const attachedCount = currentReferenceCards.length;

  return (
    <div ref={containerRef} className={cn('shrink-0', isRow && 'min-w-0')}>
      <div className={cn('relative', isRow && 'flex min-w-0 items-center gap-1')}>
        {isRow && attachedCount > 0 ? (
          <div className="flex min-w-0 max-w-[392px] items-center gap-1 overflow-x-auto pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {currentReferenceCards.map((card) => (
              <button
                key={card.id}
                type="button"
                draggable={!isDraftBusy}
                disabled={isDraftBusy}
                onClick={() => {
                  if (card.alias) onInsertReferenceMention(card.alias);
                }}
                onDragStart={(event) => {
                  setDraggedReferenceId(card.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', card.id);
                }}
                onDragOver={(event) => {
                  if (draggedReferenceId && draggedReferenceId !== card.id) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const activeCardId =
                    draggedReferenceId || event.dataTransfer.getData('text/plain');
                  if (activeCardId && activeCardId !== card.id) {
                    onReorderCanvasReferences(
                      activeDraftId,
                      activeCardId,
                      card.id
                    );
                  }
                  setDraggedReferenceId(null);
                }}
                onDragEnd={() => setDraggedReferenceId(null)}
                onPointerDownCapture={stopComposerEvent}
                title={`${card.alias ?? ''} · ${card.name}`}
                className={cn(
                  'group/reference inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border bg-white/[0.035] pl-1 pr-1.5 text-[11px] font-semibold text-[var(--beat-text-1)] transition',
                  draggedReferenceId === card.id
                    ? 'border-[var(--beat-graph)] opacity-55'
                    : 'border-white/[0.09] hover:border-white/[0.18] hover:bg-white/[0.07]'
                )}
              >
                <span className="relative inline-flex size-5 shrink-0 overflow-hidden rounded-[5px] bg-black/50">
                  {card.thumbnailUrl && card.type === 'video' ? (
                    <video
                      src={card.thumbnailUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  ) : card.thumbnailUrl ? (
                    <img
                      src={card.thumbnailUrl}
                      alt=""
                      draggable={false}
                      className="size-full object-cover"
                    />
                  ) : card.type === 'video' ? (
                    <Video className="m-auto size-3 text-white/70" />
                  ) : (
                    <ImagePlus className="m-auto size-3 text-white/70" />
                  )}
                  {card.type === 'video' ? (
                    <Video className="pointer-events-none absolute bottom-0 right-0 size-2.5 rounded-sm bg-black/65 p-0.5 text-white" />
                  ) : null}
                </span>
                <span className="whitespace-nowrap font-mono tracking-[-0.02em] text-[var(--beat-graph)]">
                  {card.alias}
                </span>
                <GripVertical className="size-3 text-white/20 transition group-hover/reference:text-white/45" />
              </button>
            ))}
          </div>
        ) : null}

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
          {!isRow && attachedCount > 0 ? (
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
                      {card.thumbnailUrl && card.type === 'video' ? (
                        <span className="relative inline-flex size-8 shrink-0 overflow-hidden rounded-md bg-black">
                          <video
                            src={card.thumbnailUrl}
                            aria-label={card.name}
                            muted
                            playsInline
                            preload="metadata"
                            className="size-full object-cover"
                          />
                          <Video className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white drop-shadow" />
                        </span>
                      ) : card.thumbnailUrl ? (
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
                      <span className="min-w-0">
                        <span className="block font-mono text-[11px] font-semibold text-[var(--beat-graph)]">
                          {card.alias}
                        </span>
                        <span className="block truncate text-[12px] font-medium">
                          {card.name}
                        </span>
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
                      {card.thumbnailUrl && card.type === 'video' ? (
                        <span className="relative inline-flex size-full bg-black">
                          <video
                            src={card.thumbnailUrl}
                            aria-label={card.name}
                            muted
                            playsInline
                            preload="metadata"
                            className="size-full object-cover"
                          />
                          <Video className="pointer-events-none absolute inset-0 m-auto size-4 text-white drop-shadow" />
                        </span>
                      ) : card.thumbnailUrl ? (
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
    </div>
  );
}
