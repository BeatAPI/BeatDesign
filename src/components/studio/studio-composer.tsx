'use client';

import {
  ArrowUp,
  Film,
  ImageIcon,
  ImagePlus,
  Loader2,
  ScanSearch,
  Sparkles,
  Video,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  getGenerationPromptConstraints,
  truncatePromptToMaxChars,
} from '@/core/effects/validation';
import {
  findWorkspaceModelOption,
  getWorkspaceAspectRatioOptions,
  type WorkspaceModelOption,
} from '@/core/effects/workspace-models';
import { getModelIconPathByModelId } from '@/core/workspace-lib/model-icons';
import type { StudioMedia } from '@/core/studio/studio-runtime';
import type { VideoAnalysisDepth } from '@/core/effects/video-analysis';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { cn } from '@/lib/utils';

export function StudioComposer({
  draft,
  media,
  imageModels,
  videoModels,
  isBusy,
  promptCharacterLimit,
  takeCount: _takeCount = 0,
  analysisDepth,
  analysisFileName,
  onDraftChange,
  onMediaChange,
  onAnalysisDepthChange,
  onAnalysisFileSelect,
  onClearAnalysisFile,
  onGenerate,
  referenceUrls = [],
  onRemoveReference,
}: {
  draft: CanvasGenerationCard;
  media: StudioMedia;
  imageModels: WorkspaceModelOption[];
  videoModels: WorkspaceModelOption[];
  isBusy: boolean;
  promptCharacterLimit: number;
  takeCount?: number;
  analysisDepth: VideoAnalysisDepth;
  analysisFileName: string | null;
  onDraftChange: (next: CanvasGenerationCard) => void;
  onMediaChange: (next: StudioMedia) => void;
  onAnalysisDepthChange: (next: VideoAnalysisDepth) => void;
  onAnalysisFileSelect: (file: File) => void;
  onClearAnalysisFile: () => void;
  onGenerate: () => void;
  referenceUrls?: string[];
  onRemoveReference?: (url: string) => void;
}) {
  const labels = useCanvasComposerLabels();
  const t = useTranslations('AppShell.studio.analysis');
  const analysisFileInputRef = useRef<HTMLInputElement | null>(null);
  const parameterPickerRef = useRef<HTMLDivElement | null>(null);
  const [isParameterOpen, setIsParameterOpen] = useState(false);
  const isAnalysis = media === 'analysis';
  const models = media === 'video' ? videoModels : imageModels;
  const selectedModel =
    findWorkspaceModelOption(models, draft.modelId) ?? models[0] ?? null;
  const promptRequired = getGenerationPromptConstraints({
    modelId: isAnalysis ? 'video-analysis' : selectedModel?.id,
  }).required;
  const selectedModeOptions = selectedModel?.modeOptions ?? [];
  const selectedVariantOptions = selectedModel?.variantOptions ?? [];
  const selectedQualityOptions = selectedModel?.qualityOptions ?? [];
  const selectedDurationOptions =
    media === 'video' ? (selectedModel?.supportedDurations ?? []) : [];
  const selectedLanguageOptions = selectedModel?.supportedLanguages ?? [];
  const selectedAspectRatioOptions = useMemo(
    () =>
      getWorkspaceAspectRatioOptions({
        model: selectedModel,
        hasImageReferences: referenceUrls.length > 0,
      }),
    [referenceUrls.length, selectedModel]
  );
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
  const primaryButtonLabel = isBusy
    ? isAnalysis
      ? t('analyzing')
      : labels.generatingLabel
    : isAnalysis
      ? t('analyze')
      : labels.generateLabel;
  const analysisModelOptions = [
    {
      value: 'standard',
      label: t('standardModel'),
      modelId: 'video-analysis-standard',
    },
    {
      value: 'deep',
      label: t('proModel'),
      modelId: 'video-analysis-pro',
    },
  ].map((option) => ({
    value: option.value,
    label: option.label,
    leading: (
      <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-white/90 ring-1 ring-black/10">
        <img
          src={getModelIconPathByModelId(option.modelId) || '/logo.png'}
          alt=""
          className="size-3 rounded-[2px]"
        />
      </span>
    ),
  }));

  useEffect(() => {
    if (
      isAnalysis ||
      selectedAspectRatioOptions.length === 0 ||
      selectedAspectRatioOptions.includes(draft.aspectRatio)
    ) {
      return;
    }
    onDraftChange({
      ...draft,
      aspectRatio:
        selectedModel?.defaultAspectRatio ?? selectedAspectRatioOptions[0],
    });
  }, [
    draft,
    isAnalysis,
    onDraftChange,
    selectedAspectRatioOptions,
    selectedModel?.defaultAspectRatio,
  ]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#09090a] via-[#09090a]/96 to-transparent px-3 pb-3 pt-12 sm:px-6 sm:pb-5 sm:pt-14">
      <div
        className={cn(
          'mx-auto w-full max-w-[1138px] p-2.5 sm:p-3.5',
          composerCardClassName
        )}
        data-beatapi-composer=""
      >
        {referenceUrls.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {referenceUrls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onRemoveReference?.(url)}
                className="size-9 overflow-hidden rounded-[10px] border border-white/[0.1]"
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <button
            type="button"
            aria-label={isAnalysis ? t('uploadVideo') : labels.uploadImageLabel}
            title={isAnalysis ? t('uploadVideo') : t('referenceUploadSoon')}
            onClick={() => {
              if (isAnalysis) analysisFileInputRef.current?.click();
            }}
            className="absolute left-0 top-0 z-10 flex size-9 rotate-[-5deg] items-center justify-center rounded-[10px] border border-dashed border-white/[0.13] bg-white/[0.03] text-[var(--beat-text-2)] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            {isAnalysis ? (
              <Video className="size-3.5" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
          </button>
          <input
            ref={analysisFileInputRef}
            type="file"
            accept=".mp4,.mov,video/mp4,video/quicktime"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAnalysisFileSelect(file);
              event.currentTarget.value = '';
            }}
          />
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
              isAnalysis
                ? t('promptPlaceholder')
                : media === 'video'
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
              value={media}
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
                {
                  value: 'analysis',
                  label: t('modeLabel'),
                  leading: (
                    <ScanSearch className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />
                  ),
                },
              ]}
              onChange={(type) =>
                onMediaChange(
                  type === 'analysis' ? 'analysis' : type === 'video' ? 'video' : 'image'
                )
              }
            />

            {isAnalysis ? (
              <>
                <WorkspaceSelect
                  ariaLabel={t('modelLabel')}
                  triggerClassName="w-fit max-w-full"
                  value={analysisDepth}
                  options={analysisModelOptions}
                  onChange={(value) =>
                    onAnalysisDepthChange(value === 'deep' ? 'deep' : 'standard')
                  }
                />
                {analysisFileName ? (
                  <button
                    type="button"
                    onClick={onClearAnalysisFile}
                    className="max-w-[220px] truncate rounded-full border border-white/[0.09] bg-white/[0.035] px-2.5 py-1 text-[11px] text-[var(--beat-text-2)]"
                    title={t('removeVideo')}
                  >
                    {analysisFileName}
                  </button>
                ) : null}
              </>
            ) : (
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
            )}

            {!isAnalysis && visibleParameterSummaryTokens.length > 0 ? (
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
              disabled={
                isBusy ||
                (promptRequired && !draft.prompt.trim()) ||
                (isAnalysis ? !analysisFileName : !selectedModel)
              }
              className={cn(
                composerGenerateButtonClassName,
                'active:translate-y-px'
              )}
              aria-label={primaryButtonLabel}
            >
              {isBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
