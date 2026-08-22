'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { StudioComposer } from '@/components/studio/studio-composer';
import { StudioGenerationFeed } from '@/components/studio/studio-generation-feed';
import { StudioStartHere } from '@/components/studio/studio-start-here';
import type { CanvasCardMediaType } from '@/core/beatcanvas/canvas-types';
import { resolveWmTaskId } from '@/core/effects/client-api';
import { resolveOutputMedia } from '@/core/effects/output-media';
import { generationValidationConstraints } from '@/core/effects/validation';
import {
  findWorkspaceModelOption,
  getDefaultSelectableWorkspaceModel,
} from '@/core/effects/workspace-models';
import {
  applyStudioDraftModel,
  createStudioDraftCard,
} from '@/core/studio/studio-draft';
import {
  buildStudioEffectInput,
  getStudioModels,
  type StudioMedia,
} from '@/core/studio/studio-runtime';
import { fetchProjectGenerations } from '@/core/workspace-lib/app/workspace-client-api';
import { invalidateWorkspaceAfterGeneration } from '@/core/workspace-lib/app/workspace-query-invalidation';
import { projectGenerationsKeys } from '@/core/workspace-lib/app/workspace-query-keys';
import { apiJsonGet, apiJsonPost } from '@/lib/api-client';

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
  const imageModels = useMemo(() => getStudioModels('image'), []);
  const videoModels = useMemo(() => getStudioModels('video'), []);
  const [draft, setDraft] = useState(() => {
    const models = initialMedia === 'video' ? videoModels : imageModels;
    const model =
      findWorkspaceModelOption(models, initialModelId) ??
      getDefaultSelectableWorkspaceModel(
        initialMedia === 'video' ? 'ai-video' : 'ai-image'
      );
    return createStudioDraftCard({
      type: initialMedia,
      model,
      prompt: initialPrompt || '',
    });
  });
  const [error, setError] = useState('');
  const models = draft.type === 'video' ? videoModels : imageModels;
  const selectedModel =
    findWorkspaceModelOption(models, draft.modelId) ?? models[0] ?? null;

  const generationsQuery = useQuery({
    queryKey: projectGenerationsKeys.list(projectId),
    queryFn: () => fetchProjectGenerations(projectId),
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (item) => item.status === 'pending' || item.status === 'processing'
      )
        ? 2500
        : false,
  });
  const feedItems = (generationsQuery.data?.items ?? []).filter(
    (item) => item.status !== 'failed'
  );

  useEffect(() => {
    if (!selectedModel || selectedModel.id === draft.modelId) return;
    setDraft((current) =>
      applyStudioDraftModel({ draft: current, model: selectedModel })
    );
  }, [draft.modelId, selectedModel]);

  const generation = useMutation({
    mutationFn: async () => {
      if (!selectedModel) {
        throw new Error('No model is available for this media type.');
      }
      if (!draft.prompt.trim()) {
        throw new Error('Describe what you want to create first.');
      }
      const payload = {
        effectId: selectedModel.effectId,
        input: buildStudioEffectInput({
          media: draft.type,
          model: selectedModel,
          prompt: draft.prompt,
          aspectRatio: draft.aspectRatio,
          duration: draft.duration,
          outputQuality: draft.outputQuality,
          mode: draft.mode,
          quality: draft.quality,
          language: draft.language,
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
      await invalidateWorkspaceAfterGeneration(queryClient);
      const wmTaskId = resolveWmTaskId(created);
      if (wmTaskId && created.status !== 'succeeded') {
        await waitForGeneration({
          wmTaskId,
          effectId: selectedModel.effectId,
        });
      } else if (!resolveOutputMedia(created.output).resultUrl) {
        throw new Error('Generation completed without a media URL.');
      }
    },
    onSuccess: () => {
      setError('');
      void invalidateWorkspaceAfterGeneration(queryClient);
    },
    onError: (generationError: Error) => {
      setError(generationError.message);
      void invalidateWorkspaceAfterGeneration(queryClient);
    },
  });

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--beat-bg)] text-[var(--beat-text-1)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_112%,rgba(255,122,51,0.12),transparent_34%),linear-gradient(180deg,#08090a_0%,#0b0b0d_48%,#08090a_100%)]" />
      <div className="pointer-events-none absolute inset-x-[8%] top-0 h-[62%] opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.16)_0.75px,transparent_0.75px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[220px] pt-8 sm:px-6 sm:pb-[210px]">
        {feedItems.length > 0 ? (
          <div className="flex min-h-full w-full flex-col justify-end">
            <StudioGenerationFeed items={feedItems} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <StudioStartHere />
          </div>
        )}
      </div>

      <StudioComposer
        draft={draft}
        imageModels={imageModels}
        videoModels={videoModels}
        isBusy={generation.isPending}
        promptCharacterLimit={generationValidationConstraints.maxPromptChars}
        takeCount={feedItems.length}
        onDraftChange={(next) => {
          if (next.type !== draft.type || next.modelId !== draft.modelId) {
            const nextModels =
              next.type === 'video' ? videoModels : imageModels;
            const nextModel =
              findWorkspaceModelOption(nextModels, next.modelId) ??
              nextModels[0] ??
              null;
            if (nextModel) {
              setDraft(
                applyStudioDraftModel({
                  draft: { ...next, type: next.type as CanvasCardMediaType },
                  model: nextModel,
                })
              );
              return;
            }
          }
          setDraft(next);
        }}
        onGenerate={() => {
          setError('');
          generation.mutate();
        }}
      />

      {error ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-[88px] z-30 px-6 text-center text-sm text-[var(--beatcanvas-error)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
