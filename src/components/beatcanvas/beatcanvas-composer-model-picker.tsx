'use client';

import type { WorkspaceModelOption } from '@/core/effects/workspace-models';
import { getModelIconPathByModelId } from '@/core/workspace-lib/model-icons';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import type { RefObject } from 'react';

import {
  composerFieldButtonClassName,
  composerFieldSlotClassName,
  composerFloatingPanelClassName,
  getComposerOptionRowClassName,
  stopComposerEvent,
} from './beatcanvas-composer-utils';

export const resolveModelPickerOpenStateAfterSelection = (
  tone: 'default' | 'batch'
) => false;

export function BeatCanvasComposerModelPicker({
  activeDraftId,
  containerRef,
  isDraftBusy,
  isOpen,
  modelOptions,
  onDraftModelChange,
  onOpenChange,
  selectedModelLabel,
  selectedModelId,
  tone = 'default',
}: {
  activeDraftId: string;
  containerRef?: RefObject<HTMLDivElement | null>;
  isDraftBusy: boolean;
  isOpen: boolean;
  modelOptions: WorkspaceModelOption[];
  onDraftModelChange: (draftId: string, modelId: string) => void;
  onOpenChange: (nextOpen: boolean) => void;
  selectedModelLabel: string;
  selectedModelId: string | null;
  tone?: 'default' | 'batch';
}) {
  const selectedModelIconPath = selectedModelId
    ? getModelIconPathByModelId(selectedModelId)
    : null;
  const isBatchTone = tone === 'batch';

  return (
    <div
      ref={containerRef}
      className={cn(
        composerFieldSlotClassName,
        !isBatchTone && 'min-w-0 max-w-full',
        isBatchTone && 'lg:max-w-none'
      )}
    >
      <button
        type="button"
        disabled={modelOptions.length === 0 || isDraftBusy}
        onClick={() => {
          onOpenChange(!isOpen);
        }}
        onPointerDownCapture={stopComposerEvent}
        className={cn(
          composerFieldButtonClassName,
          isBatchTone
            ? 'min-h-[44px] w-full rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent'
            : 'w-fit max-w-full'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedModelIconPath ? (
            <span
              className={cn(
                'grid shrink-0 place-items-center rounded-[5px] bg-white/90 ring-1 ring-black/10',
                isBatchTone ? 'size-8' : 'size-4'
              )}
            >
              <img
                alt=""
                aria-hidden="true"
                src={selectedModelIconPath}
                className={cn(
                  'h-auto w-auto object-contain',
                  isBatchTone ? 'max-h-6 max-w-6' : 'max-h-3 max-w-3'
                )}
              />
            </span>
          ) : (
            <Sparkles
              className={cn(
                'shrink-0 text-[var(--beat-graph)]',
                isBatchTone ? 'size-5' : 'size-3.5'
              )}
            />
          )}
          <span className="min-w-0">
            <span
              className={cn(
                'block line-clamp-1 min-w-0',
                isBatchTone
                  ? 'text-[18px] font-semibold tracking-[-0.04em] text-white'
                  : 'text-[12px] font-semibold text-white'
              )}
            >
              {selectedModelLabel}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            'pointer-events-none size-3.5 shrink-0 transition-transform duration-200',
            isBatchTone ? 'text-[var(--beat-text-2)]' : 'text-white/45',
            isOpen ? 'rotate-180' : ''
          )}
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            composerFloatingPanelClassName,
            'left-0 w-[min(360px,calc(100vw-48px))]'
          )}
          onPointerDownCapture={stopComposerEvent}
        >
          <div className="space-y-1.5">
            {modelOptions.map((model) => {
              const isSelected = model.id === selectedModelId;
              const iconPath = getModelIconPathByModelId(model.id);

              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={model.available === false || isDraftBusy}
                  onPointerDownCapture={stopComposerEvent}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isSelected) {
                      onDraftModelChange(activeDraftId, model.id);
                    }
                    onOpenChange(
                      resolveModelPickerOpenStateAfterSelection(tone)
                    );
                  }}
                  className={cn(
                    getComposerOptionRowClassName(isSelected),
                    model.available === false
                      ? 'cursor-not-allowed opacity-60'
                      : ''
                  )}
                >
                  {iconPath ? (
                    <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-white/90 ring-1 ring-black/10">
                      <img
                        alt=""
                        aria-hidden="true"
                        src={iconPath}
                        className="max-h-3.5 max-w-3.5 object-contain"
                      />
                    </span>
                  ) : (
                    <Sparkles className="size-3.5 shrink-0 text-white/50" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-[var(--beat-text-1)]">
                      {model.name}
                    </span>
                  </span>
                  {isSelected ? (
                    <Check className="size-3.5 shrink-0 text-[var(--beat-accent)]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
