import type {
  WorkspaceAspectRatio,
  WorkspaceBackgroundSource,
  WorkspaceCharacterOrientation,
  WorkspaceDuration,
  WorkspaceLanguage,
  WorkspaceModelMode,
  WorkspaceModelVariant,
  WorkspaceOutputQuality,
  WorkspaceQualityOption,
} from '@/core/effects/workspace-models';
import { cn } from '@/lib/utils';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';
import { ChevronDown } from 'lucide-react';
import type { RefObject } from 'react';

import {
  compactParameterGroupClass,
  composerFieldButtonClassName,
  composerFieldSlotClassName,
  composerFloatingPanelClassName,
  composerSectionLabelClassName,
  getParameterChipClassName,
  normalizeComposerToken,
  stopComposerEvent,
} from './beatcanvas-composer-utils';
import type { CanvasLabels } from './beatcanvas-front-layer-context';

export const commitComposerParameterSelection = ({
  applyChange,
  onOpenChange,
}: {
  applyChange: () => void;
  onOpenChange: (nextOpen: boolean) => void;
}) => {
  applyChange();
  onOpenChange(false);
};

export function BeatCanvasComposerParameterPicker({
  activeDraftCard,
  containerRef,
  isDraftBusy,
  isOpen,
  labels,
  onDraftAspectRatioChange,
  onDraftBackgroundSourceChange,
  onDraftCharacterOrientationChange,
  onDraftDurationChange,
  onDraftLanguageChange,
  onDraftModeChange,
  onDraftOutputQualityChange,
  onDraftQualityChange,
  onDraftVariantChange,
  onOpenChange,
  parameterSummaryLabel,
  selectedAspectRatioOptions,
  selectedBackgroundSourceOptions,
  selectedCharacterOrientationOptions,
  selectedDurationOptions,
  selectedLanguageOptions,
  selectedModeOptions,
  selectedOutputQualities,
  selectedQualityOptions,
  selectedVariantOptions,
  tone = 'default',
  visibleParameterSummaryTokens,
}: {
  activeDraftCard: CanvasGenerationCard;
  containerRef?: RefObject<HTMLDivElement | null>;
  isDraftBusy: boolean;
  isOpen: boolean;
  labels: CanvasLabels;
  onDraftAspectRatioChange: (
    draftId: string,
    aspectRatio: WorkspaceAspectRatio
  ) => void;
  onDraftBackgroundSourceChange: (
    draftId: string,
    backgroundSource: WorkspaceBackgroundSource
  ) => void;
  onDraftCharacterOrientationChange: (
    draftId: string,
    characterOrientation: WorkspaceCharacterOrientation
  ) => void;
  onDraftDurationChange: (draftId: string, duration: WorkspaceDuration) => void;
  onDraftLanguageChange: (draftId: string, language: WorkspaceLanguage) => void;
  onDraftModeChange: (draftId: string, mode: WorkspaceModelMode) => void;
  onDraftOutputQualityChange: (
    draftId: string,
    quality: WorkspaceOutputQuality
  ) => void;
  onDraftQualityChange: (
    draftId: string,
    quality: WorkspaceQualityOption
  ) => void;
  onDraftVariantChange: (
    draftId: string,
    variant: WorkspaceModelVariant
  ) => void;
  onOpenChange: (nextOpen: boolean) => void;
  parameterSummaryLabel: string;
  selectedAspectRatioOptions: WorkspaceAspectRatio[];
  selectedBackgroundSourceOptions: WorkspaceBackgroundSource[];
  selectedCharacterOrientationOptions: WorkspaceCharacterOrientation[];
  selectedDurationOptions: WorkspaceDuration[];
  selectedLanguageOptions: WorkspaceLanguage[];
  selectedModeOptions: WorkspaceModelMode[];
  selectedOutputQualities: WorkspaceOutputQuality[];
  selectedQualityOptions: WorkspaceQualityOption[];
  selectedVariantOptions: WorkspaceModelVariant[];
  tone?: 'default' | 'batch';
  visibleParameterSummaryTokens: string[];
}) {
  const isBatchTone = tone === 'batch';
  const commitSelection = (applyChange: () => void) =>
    commitComposerParameterSelection({ applyChange, onOpenChange });

  return (
    <div
      ref={containerRef}
      className={cn(
        isBatchTone
          ? cn(composerFieldSlotClassName, 'lg:max-w-none')
          : 'relative w-fit min-w-0 max-w-[min(240px,100%)] flex-none'
      )}
    >
      <button
        type="button"
        disabled={isDraftBusy}
        title={parameterSummaryLabel}
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
        <span
          className={cn(
            'flex min-w-0 items-center gap-2 overflow-hidden',
            isBatchTone ? 'text-white' : 'text-white'
          )}
        >
          {visibleParameterSummaryTokens.map((token, index) => (
            <span key={`${token}-${index}`} className="contents">
              {!isBatchTone && index > 0 ? (
                <span className="shrink-0 text-white/35">·</span>
              ) : null}
              {isBatchTone && index > 0 ? (
                <span className="shrink-0 text-white/45">·</span>
              ) : null}
              <span
                className={cn(
                  'min-w-0',
                  isBatchTone
                    ? 'text-[18px] font-semibold tracking-[-0.04em] text-white'
                    : 'text-[12px] font-medium',
                  index === visibleParameterSummaryTokens.length - 1
                    ? 'truncate'
                    : 'shrink-0'
                )}
              >
                {token}
              </span>
            </span>
          ))}
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
            'right-0 w-[min(360px,calc(100vw-48px))]'
          )}
          onPointerDownCapture={stopComposerEvent}
        >
          <div className="space-y-3">
            {selectedOutputQualities.length > 0 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.outputQualityLabel}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {selectedOutputQualities.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftOutputQualityChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.outputQuality === item
                      )}
                    >
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedAspectRatioOptions.length > 0 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.aspectRatioLabel}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {selectedAspectRatioOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftAspectRatioChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.aspectRatio === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedDurationOptions.length > 0 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.durationLabel}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {selectedDurationOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftDurationChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.duration === item
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedCharacterOrientationOptions.length > 0 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.characterOrientationLabel}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedCharacterOrientationOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftCharacterOrientationChange(
                            activeDraftCard.id,
                            item
                          )
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.characterOrientation === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedBackgroundSourceOptions.length > 0 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.backgroundSourceLabel}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedBackgroundSourceOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftBackgroundSourceChange(
                            activeDraftCard.id,
                            item
                          )
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.backgroundSource === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedLanguageOptions.length > 0 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.languageLabel}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedLanguageOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftLanguageChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.language === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedModeOptions.length > 1 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.modeOptionLabel}
                </p>
                <div className={compactParameterGroupClass}>
                  {selectedModeOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftModeChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.mode === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedVariantOptions.length > 1 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.variantOptionLabel}
                </p>
                <div className={compactParameterGroupClass}>
                  {selectedVariantOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftVariantChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.variant === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedQualityOptions.length > 1 ? (
              <section className="space-y-1.5">
                <p className={composerSectionLabelClassName}>
                  {labels.qualityOptionLabel}
                </p>
                <div className={compactParameterGroupClass}>
                  {selectedQualityOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isDraftBusy}
                      onClick={() =>
                        commitSelection(() =>
                          onDraftQualityChange(activeDraftCard.id, item)
                        )
                      }
                      className={getParameterChipClassName(
                        activeDraftCard.quality === item
                      )}
                    >
                      {normalizeComposerToken(item, labels)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
