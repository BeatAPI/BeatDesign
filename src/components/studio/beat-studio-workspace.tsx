'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  Film,
  ImageIcon,
  ImagePlus,
  Loader2,
  Sparkles,
} from 'lucide-react';

import { resolveOutputMedia } from '@/core/effects/output-media';
import { resolveWmTaskId } from '@/core/effects/client-api';
import { getModelIconPathByModelId } from '@/core/workspace-lib/model-icons';
import { WorkspaceSelect } from '@/components/app/workspace-select';
import {
  composerCardClassName,
  composerGenerateButtonClassName,
} from '@/components/app/composer-styles';
import {
  buildStudioEffectInput,
  getStudioModels,
  type StudioMedia,
} from '@/core/studio/studio-runtime';
import { apiJsonGet, apiJsonPost } from '@/lib/api-client';
import { invalidateWorkspaceAfterGeneration } from '@/core/workspace-lib/app/workspace-query-invalidation';
import { StudioStartHere } from '@/components/studio/studio-start-here';
import { cn } from '@/lib/utils';

type GenerationResponse = {
  status?: 'pending' | 'processing' | 'succeeded' | 'failed';
  wmTaskId?: string;
  output?: unknown;
  error?: string;
  uploadIntentToken?: string;
};

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitForGeneration({
  wmTaskId,
  effectId,
}: {
  wmTaskId: string;
  effectId: number;
}) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await apiJsonGet<GenerationResponse>(
      `/api/effects/status?wmTaskId=${encodeURIComponent(wmTaskId)}&effectId=${effectId}&syncProvider=1`
    );
    if (result.status === 'succeeded') return result.output;
    if (result.status === 'failed') {
      throw new Error(result.error || 'Generation failed');
    }
    await wait(2500);
  }
  throw new Error(
    'Generation is still processing. You can find it in History.'
  );
}

export function BeatStudioWorkspace({
  projectId,
  initialTarget,
  initialModelId,
  initialPrompt,
}: {
  projectId: string;
  initialTarget: string | null;
  initialModelId: string | null;
  initialPrompt: string | null;
}) {
  const queryClient = useQueryClient();
  const initialMedia: StudioMedia =
    initialTarget === 'video' ? 'video' : 'image';
  const [media, setMedia] = useState<StudioMedia>(initialMedia);
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [aspectRatio, setAspectRatio] = useState(
    initialMedia === 'video' ? '16:9' : '1:1'
  );
  const [modelId, setModelId] = useState(initialModelId || '');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const models = useMemo(() => getStudioModels(media), [media]);
  const selectedModel =
    models.find((model) => model.id === modelId) ?? models[0] ?? null;

  useEffect(() => {
    if (!selectedModel) return;
    if (selectedModel.id !== modelId) setModelId(selectedModel.id);
    const ratios = selectedModel.supportedAspectRatios || [];
    if (ratios.length && !ratios.includes(aspectRatio as never)) {
      setAspectRatio(selectedModel.defaultAspectRatio || ratios[0]);
    }
  }, [aspectRatio, modelId, selectedModel]);

  const generation = useMutation({
    mutationFn: async () => {
      if (!selectedModel) {
        throw new Error('No model is available for this media type.');
      }
      if (!prompt.trim()) {
        throw new Error('Describe what you want to create first.');
      }
      const payload = {
        effectId: selectedModel.effectId,
        input: buildStudioEffectInput({
          media,
          model: selectedModel,
          prompt,
          aspectRatio,
        }),
        projectId,
      };
      const precheck = await apiJsonPost<GenerationResponse>(
        '/api/effects/precheck',
        { ...payload, expectedUploadCount: 0 }
      );
      if (precheck.error) throw new Error(precheck.error);
      if (!precheck.uploadIntentToken) {
        throw new Error('Generation validation did not return an intent.');
      }
      const created = await apiJsonPost<GenerationResponse>(
        '/api/effects/generate',
        {
          ...payload,
          generationIntentToken: precheck.uploadIntentToken,
        }
      );
      if (created.status === 'failed') {
        throw new Error(created.error || 'Generation failed');
      }
      let output = created.output;
      const wmTaskId = resolveWmTaskId(created);
      if (wmTaskId && created.status !== 'succeeded') {
        output = await waitForGeneration({
          wmTaskId,
          effectId: selectedModel.effectId,
        });
      }
      const mediaOutput = resolveOutputMedia(output);
      if (!mediaOutput.resultUrl) {
        throw new Error('Generation completed without a media URL.');
      }
      return mediaOutput.resultUrl;
    },
    onSuccess: (url) => {
      setResultUrl(url);
      setError('');
      void invalidateWorkspaceAfterGeneration(queryClient);
    },
    onError: (generationError: Error) => setError(generationError.message),
  });

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--beat-bg)] text-[var(--beat-text-1)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_112%,rgba(255,122,51,0.12),transparent_34%),linear-gradient(180deg,#08090a_0%,#0b0b0d_48%,#08090a_100%)]" />
      <div className="pointer-events-none absolute inset-x-[8%] top-0 h-[62%] opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.16)_0.75px,transparent_0.75px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 pb-[220px] pt-8 sm:px-6 sm:pb-[210px] md:pb-[190px]">
        {resultUrl ? (
          <div className="w-full max-w-[780px] overflow-hidden rounded-[var(--beat-radius)] border border-white/[0.09] bg-black shadow-[0_38px_120px_rgba(0,0,0,0.58)]">
            {media === 'video' ? (
              <video
                src={resultUrl}
                controls
                autoPlay
                className="max-h-[55vh] w-full object-contain"
              />
            ) : (
              <img
                src={resultUrl}
                alt="Generated result"
                className="max-h-[55vh] w-full object-contain"
              />
            )}
          </div>
        ) : (
          <StudioStartHere />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#09090a] via-[#09090a]/96 to-transparent px-3 pb-3 pt-12 sm:px-6 sm:pb-5 sm:pt-14">
        <div
          className={cn(
            'mx-auto w-full max-w-[1138px] overflow-hidden p-2.5 sm:p-3.5',
            composerCardClassName
          )}
          data-beatapi-composer=""
        >
          <div className="relative">
            <button
              type="button"
              aria-label="Add a reference image"
              title="Reference upload coming next"
              className="absolute left-0 top-0 z-10 flex size-9 rotate-[-5deg] items-center justify-center rounded-[10px] border border-dashed border-white/[0.13] bg-white/[0.03] text-[var(--beat-text-2)] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <ImagePlus className="size-3.5" />
            </button>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the subject, motion, camera, lighting, and atmosphere you want to create."
              className="h-[80px] min-h-[80px] w-full resize-none bg-transparent py-2 pl-[52px] pr-3 text-[14px] leading-6 text-[var(--beat-text-1)] outline-none placeholder:text-white/35 sm:h-[92px] sm:min-h-[92px] sm:pl-[56px] sm:pr-16 sm:text-[15px]"
            />
          </div>

          <div className="mt-1.5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
              <div className="min-w-0">
                <WorkspaceSelect
                  ariaLabel="Media type"
                  triggerClassName="min-w-[96px]"
                  value={media}
                  options={[
                    {
                      value: 'image',
                      label: 'Image',
                      leading: (
                        <ImageIcon className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />
                      ),
                    },
                    {
                      value: 'video',
                      label: 'Video',
                      leading: (
                        <Film className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />
                      ),
                    },
                  ]}
                  onChange={(next) => setMedia(next as StudioMedia)}
                />
              </div>

              <div className="min-w-0">
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
                  onChange={setModelId}
                  leadingIcon={<Sparkles className="size-3.5 shrink-0 text-[var(--beat-text-2)]" />}
                />
              </div>

              <div className="min-w-0">
                <WorkspaceSelect
                  ariaLabel="Aspect ratio"
                  triggerClassName="min-w-[88px]"
                  value={aspectRatio}
                  options={(
                    selectedModel?.supportedAspectRatios || [
                      media === 'video' ? '16:9' : '1:1',
                    ]
                  ).map((ratio) => ({ value: ratio, label: ratio }))}
                  onChange={setAspectRatio}
                  leadingIcon={
                    <span className="size-3.5 shrink-0 rounded-[3px] border border-white/40" />
                  }
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  generation.mutate();
                }}
                disabled={
                  generation.isPending || !prompt.trim() || !selectedModel
                }
                className={cn(
                  composerGenerateButtonClassName,
                  'active:translate-y-px'
                )}
                aria-label="Generate"
              >
                {generation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p className="px-1 pt-3 text-sm text-[var(--beatcanvas-error)]">{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
