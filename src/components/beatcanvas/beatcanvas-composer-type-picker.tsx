import type { CanvasGenerationMode } from '@/core/beatcanvas/canvas-types';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ImageIcon, ScanSearch, Video } from 'lucide-react';
import type { RefObject } from 'react';

import {
  composerFieldButtonClassName,
  composerFloatingPanelClassName,
  getComposerOptionRowClassName,
  stopComposerEvent,
} from './beatcanvas-composer-utils';
import type { CanvasLabels } from './beatcanvas-front-layer-context';

const TASK_TYPES: CanvasGenerationMode[] = ['image', 'video', 'analysis'];

export function BeatCanvasComposerTypePicker({
  activeDraftId,
  containerRef,
  isDraftBusy,
  isOpen,
  labels,
  onDraftTaskTypeChange,
  onOpenChange,
  selectedType,
}: {
  activeDraftId: string;
  containerRef?: RefObject<HTMLDivElement | null>;
  isDraftBusy: boolean;
  isOpen: boolean;
  labels: CanvasLabels;
  onDraftTaskTypeChange: (
    draftId: string,
    taskType: CanvasGenerationMode
  ) => void;
  onOpenChange: (nextOpen: boolean) => void;
  selectedType: CanvasGenerationMode;
}) {
  const selectedLabel =
    selectedType === 'image'
      ? labels.imageModeLabel
      : selectedType === 'analysis'
        ? labels.analysisModeLabel
        : labels.videoModeLabel;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        disabled={isDraftBusy}
        aria-label={labels.typeLabel}
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
        onPointerDownCapture={stopComposerEvent}
        className={cn(composerFieldButtonClassName, 'w-fit')}
      >
        {selectedType === 'image' ? (
          <ImageIcon className="size-3.5 shrink-0 text-white/70" />
        ) : selectedType === 'analysis' ? (
          <ScanSearch className="size-3.5 shrink-0 text-white/70" />
        ) : (
          <Video className="size-3.5 shrink-0 text-white/70" />
        )}
        <span className="whitespace-nowrap text-[12px] font-semibold text-white">
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn(
            'pointer-events-none size-3.5 shrink-0 text-white/45 transition-transform duration-200',
            isOpen ? 'rotate-180' : ''
          )}
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            composerFloatingPanelClassName,
            'left-0 w-[min(190px,calc(100vw-48px))]'
          )}
          onPointerDownCapture={stopComposerEvent}
        >
          <div className="space-y-1">
            {TASK_TYPES.map((taskType) => {
              const isSelected = taskType === selectedType;
              const label =
                taskType === 'image'
                  ? labels.imageModeLabel
                  : taskType === 'analysis'
                    ? labels.analysisModeLabel
                    : labels.videoModeLabel;

              return (
                <button
                  key={taskType}
                  type="button"
                  disabled={isDraftBusy}
                  onPointerDownCapture={stopComposerEvent}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isSelected) {
                      onDraftTaskTypeChange(activeDraftId, taskType);
                    }
                    onOpenChange(false);
                  }}
                  className={getComposerOptionRowClassName(isSelected)}
                >
                  {taskType === 'image' ? (
                    <ImageIcon className="size-3.5 shrink-0 text-white/60" />
                  ) : taskType === 'analysis' ? (
                    <ScanSearch className="size-3.5 shrink-0 text-white/60" />
                  ) : (
                    <Video className="size-3.5 shrink-0 text-white/60" />
                  )}
                  <span className="flex-1 text-[12px] font-medium text-[var(--beat-text-1)]">
                    {label}
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
