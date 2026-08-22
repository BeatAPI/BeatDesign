'use client';

import {
  ArrowUp,
  Film,
  ImageIcon,
  ImagePlus,
  Loader2,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { useRef, useState } from 'react';

import {
  composerCardClassName,
  composerGenerateButtonClassName,
} from '@/components/app/composer-styles';
import { WorkspaceSelect } from '@/components/app/workspace-select';
import { BeatCanvasComposerParameterPicker } from '@/components/beatcanvas/beatcanvas-composer-parameter-picker';
import { normalizeComposerToken } from '@/components/beatcanvas/beatcanvas-composer-utils';
import { useCanvasComposerLabels } from '@/components/beatcanvas/use-canvas-composer-labels';
import type { CanvasGenerationCard } from '@/core/beatcanvas/canvas-types';
import {
  countPromptCharacters,
  truncatePromptToMaxChars,
} from '@/core/effects/validation';
import {
  findWorkspaceModelOption,
  type WorkspaceModelOption,
} from '@/core/effects/workspace-models';
import { getModelIconPathByModelId } from '@/core/workspace-lib/model-icons';
import { cn } from '@/lib/utils';

export function StudioComposer({
  draft,
  imageModels,
  videoModels,
  isBusy,
  promptCharacterLimit,
  takeCount = 0,
  onDraftChange,
  onGenerate,
}: {
  draft: CanvasGenerationCard;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  isBusy: boolean;
  promptCharacterLimit: number;
  takeCount?: number;
  onDraftChange: (next: CanvasGenerationCard) => void;
  onGenerate: () => void;
}) {
  const labels = useCanvasComposerLabels();
  const parameterPickerRef = useRef<HTMLDivElement | null>(null);
  const [isParameterOpen, setIsParameterOpen] = useState(false);
  const models = draft.type === 'video' ? videoModels : imageModels;
  const selectedModel =
    findWorkspaceModelOption(models, draft.modelId) ?? models[0] ?? null;
  const selectedModeOptions = selectedModel?.modeOptions ?? [];
  const selectedVariantOptions = selectedModel?.variantOptions ?? [];
  const selectedQualityOptions = selectedModel?.qualityOptions ?? [];
  const selectedDurationOptions =
    draft.type === 'video' ? (selectedModel?.supportedDurations ?? []) : [];
  const selectedLanguageOptions = selectedModel?.supportedLanguages ?? [];
  const selectedAspectRatioOptions = selectedModel?.supportedAspectRatios ?? [];
  const selectedOutputQualities = selectedModel?.supportedOutputQualities ?? [];
  const selectedCharacterOrientationOptions =
    selectedModel?.characterOrientationOptions ?? [];
  const selectedBackgroundSourceOptions =
    selectedModel?.backgroundSourceOptions ?? [];
  const visibleParameterSummaryTokens = [
    ...(selectedOutputQualities.length > 0
      ? [draft.outputQuality.toUpperCase()]
      : []),
    ...(selectedAspectRatioOptions.length > 0
      ? [normalizeComposerToken(draft.aspectRatio, labels)]
      : []),
    ...(selectedDurationOptions.length > 0 ? [draft.duration] : []),
    ...(selectedModeOptions.length > 1
      ? [normalizeComposerToken(draft.mode, labels)]
      : []),
    ...(selectedVariantOptions.length > 1
      ? [normalizeComposerToken(draft.variant, labels)]
      : []),
    ...(selectedQualityOptions.length > 1
      ? [normalizeComposerToken(draft.quality, labels)]
      : []),
  ];
  const promptCharacterCount = countPromptCharacters(draft.prompt);
  const hasExistingTakes = takeCount > 0;
  const primaryButtonLabel = isBusy
    ? labels.generatingLabel
    : hasExistingTakes
      ? labels.regenerateLabel
      : labels.generateLabel;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#09090a] via-[#09090a]/96 to-transparent px-3 pb-3 pt-12 sm:px-6 sm:pb-5 sm:pt-14">
      <div
        className={cn(
          'mx-auto w-full max-w-[1138px] p-2.5 sm:p-3.5',
          composerCardClassName
        )}
        data-beatapi-composer=""
      >
        <div className="relative">
          <button
            type="button"
            aria-label={labels.uploadImageLabel}
            title="Reference upload coming next"
            className="absolute left-0 top-0 z-10 flex size-9 rotate-[-5deg] items-center justify-center rounded-[10px] border border-dashed border-white/[0.13] bg-white/[0.03] text-[var(--beat-text-2)] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            <ImagePlus className="size-3.5" />
          </button>
          <textarea
            value={draft.prompt}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                prompt: truncatePromptToMaxChars(
                  event.target.value,
                  promptCharacterLimit
                ),
              })
            }
            placeholder={
              draft.type === 'video'
                ? labels.videoPromptPlaceholder
                : labels.imagePromptPlaceholder
            }
            disabled={isBusy}
            className="h-[80px] min-h-[80px] w-full resize-none bg-transparent py-2 pl-[52px] pr-3 text-[14px] leading-6 text-[var(--beat-text-1)] outline-none placeholder:text-white/35 sm:h-[92px] sm:min-h-[92px] sm:pl-[56px] sm:pr-16 sm:text-[15px]"
          />
        </div>

        <div className="mt-1.5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <WorkspaceSelect
              ariaLabel="Media type"
              triggerClassName="min-w-[96px]"
              value={draft.type}
              options={[
                {
                  value: 'image',
                  label: labels.imageModeLabel,
                  leading: (
                    <ImageIcon className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />
                  ),
                },
                {
                  value: 'video',
                  label: labels.videoModeLabel,
                  leading: (
                    <Film className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />
                  ),
                },
              ]}
              onChange={(type) =>
                onDraftChange({
                  ...draft,
                  type: type === 'video' ? 'video' : 'image',
                })
              }
            />

            <WorkspaceSelect
              ariaLabel="Model"
              triggerClassName="w-fit max-w-full"
              value={selectedModel?.id || ''}
              options={models.map((model) => ({
                value: model.id,
                label: model.name,
                leading: (
                  <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-white/90 ring-1 ring-black/10">
                    <img
                      src={getModelIconPathByModelId(model.id) || '/logo.png'}
                      alt=""
                      className="size-3 rounded-[2px]"
                    />
                  </span>
                ),
              }))}
              onChange={(modelId) => onDraftChange({ ...draft, modelId })}
              leadingIcon={
                <Sparkles className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />
              }
            />

            {visibleParameterSummaryTokens.length > 0 ? (
              <BeatCanvasComposerParameterPicker
                activeDraftCard={draft}
                containerRef={parameterPickerRef}
                isDraftBusy={isBusy}
                isOpen={isParameterOpen}
                labels={labels}
                onDraftAspectRatioChange={(_draftId, aspectRatio) =>
                  onDraftChange({ ...draft, aspectRatio })
                }
                onDraftBackgroundSourceChange={(_draftId, backgroundSource) =>
                  onDraftChange({ ...draft, backgroundSource })
                }
                onDraftCharacterOrientationChange={(
                  _draftId,
                  characterOrientation
                ) => onDraftChange({ ...draft, characterOrientation })}
                onDraftDurationChange={(_draftId, duration) =>
                  onDraftChange({ ...draft, duration })
                }
                onDraftLanguageChange={(_draftId, language) =>
                  onDraftChange({ ...draft, language })
                }
                onDraftModeChange={(_draftId, mode) =>
                  onDraftChange({ ...draft, mode })
                }
                onDraftOutputQualityChange={(_draftId, outputQuality) =>
                  onDraftChange({ ...draft, outputQuality })
                }
                onDraftQualityChange={(_draftId, quality) =>
                  onDraftChange({ ...draft, quality })
                }
                onDraftVariantChange={(_draftId, variant) =>
                  onDraftChange({ ...draft, variant })
                }
                onOpenChange={setIsParameterOpen}
                parameterSummaryLabel={labels.parameterLabel}
                selectedAspectRatioOptions={selectedAspectRatioOptions}
                selectedBackgroundSourceOptions={
                  selectedBackgroundSourceOptions
                }
                selectedCharacterOrientationOptions={
                  selectedCharacterOrientationOptions
                }
                selectedDurationOptions={selectedDurationOptions}
                selectedLanguageOptions={selectedLanguageOptions}
                selectedModeOptions={selectedModeOptions}
                selectedOutputQualities={selectedOutputQualities}
                selectedQualityOptions={selectedQualityOptions}
                selectedVariantOptions={selectedVariantOptions}
                visibleParameterSummaryTokens={visibleParameterSummaryTokens}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
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
              onClick={onGenerate}
              disabled={isBusy || !draft.prompt.trim() || !selectedModel}
              className={cn(
                composerGenerateButtonClassName,
                'active:translate-y-px'
              )}
              aria-label={primaryButtonLabel}
            >
              {isBusy ? (
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
    </div>
  );
}
