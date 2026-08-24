'use client';

import { getModelIconPathByModelId } from '@/core/workspace-lib/model-icons';
import type { VideoAnalysisDepth } from '@/core/effects/video-analysis';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ScanSearch } from 'lucide-react';
import type { RefObject } from 'react';

import {
  composerFieldButtonClassName,
  composerFieldSlotClassName,
  composerFloatingPanelClassName,
  getComposerOptionRowClassName,
  stopComposerEvent,
} from './beatcanvas-composer-utils';
import type { CanvasLabels } from './beatcanvas-front-layer-context';

const ANALYSIS_DEPTHS: VideoAnalysisDepth[] = ['standard', 'deep'];

export function BeatCanvasAnalysisDepthPicker({
  activeDraftId,
  containerRef,
  depth,
  isDraftBusy,
  isOpen,
  labels,
  onDepthChange,
  onOpenChange,
}: {
  activeDraftId: string;
  containerRef?: RefObject<HTMLDivElement | null>;
  depth: VideoAnalysisDepth;
  isDraftBusy: boolean;
  isOpen: boolean;
  labels: CanvasLabels;
  onDepthChange: (draftId: string, depth: VideoAnalysisDepth) => void;
  onOpenChange: (nextOpen: boolean) => void;
}) {
  const label =
    depth === 'deep'
      ? labels.analysisProModelLabel
      : labels.analysisStandardModelLabel;
  const modelId =
    depth === 'deep' ? 'video-analysis-pro' : 'video-analysis-standard';
  const iconPath = getModelIconPathByModelId(modelId);

  return (
    <div ref={containerRef} className={cn(composerFieldSlotClassName, 'min-w-0')}>
      <button
        type="button"
        aria-label={labels.analysisModelLabel}
        aria-expanded={isOpen}
        disabled={isDraftBusy}
        onClick={() => onOpenChange(!isOpen)}
        onPointerDownCapture={stopComposerEvent}
        className={cn(composerFieldButtonClassName, 'w-fit max-w-full')}
      >
        {iconPath ? (
          <span className="grid size-4 shrink-0 place-items-center rounded-[5px] bg-white/90 ring-1 ring-black/10">
            <img src={iconPath} alt="" className="max-h-3 max-w-3 object-contain" />
          </span>
        ) : (
          <ScanSearch className="size-3.5 shrink-0 text-[var(--beat-graph)]" />
        )}
        <span className="line-clamp-1 text-[12px] font-semibold text-white">
          {label}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-white/45 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            composerFloatingPanelClassName,
            'left-0 w-[min(300px,calc(100vw-48px))]'
          )}
          onPointerDownCapture={stopComposerEvent}
        >
          <div className="space-y-1">
            {ANALYSIS_DEPTHS.map((option) => {
              const isSelected = option === depth;
              const optionLabel =
                option === 'deep'
                  ? labels.analysisProModelLabel
                  : labels.analysisStandardModelLabel;
              const optionIcon = getModelIconPathByModelId(
                option === 'deep'
                  ? 'video-analysis-pro'
                  : 'video-analysis-standard'
              );

              return (
                <button
                  key={option}
                  type="button"
                  disabled={isDraftBusy}
                  onClick={() => {
                    if (!isSelected) onDepthChange(activeDraftId, option);
                    onOpenChange(false);
                  }}
                  className={getComposerOptionRowClassName(isSelected)}
                >
                  {optionIcon ? (
                    <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-white/90 ring-1 ring-black/10">
                      <img src={optionIcon} alt="" className="max-h-3.5 max-w-3.5 object-contain" />
                    </span>
                  ) : (
                    <ScanSearch className="size-3.5 shrink-0 text-white/60" />
                  )}
                  <span className="flex-1 text-left text-[12px] font-medium text-[var(--beat-text-1)]">
                    {optionLabel}
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
