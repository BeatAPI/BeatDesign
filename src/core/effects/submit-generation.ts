import { createAdapter } from '@/core/adapters/adapter-factory';
import { getEffectById } from '@/core/effects/effects';
import { getWorkspaceEffectRegistryEntryByEffectId } from '@/core/effects/effect-registry';
import {
  getGenerationConcurrencyErrorMessage,
  resolveGenerationConcurrencyGate,
} from '@/core/effects/generation-concurrency';
import {
  resolveGenerationSubmitTransition,
  resolveProviderTaskId,
} from '@/core/effects/generation-orchestrator';
import { persistEffectOutputIfNeeded } from '@/core/effects/output-storage';
import {
  countRunningGenerationsForProject,
  findActiveProject,
  recordGeneration,
  updateGenerationById,
} from '@/core/effects/record-generation';
import { startBackendPollingForGeneration } from '@/core/effects/server-poller';
import { withGenerationSubmissionLock } from '@/core/effects/generation-submission-lock';
import {
  getGenerationPromptMaxChars,
  validateGenerationPrompt,
} from '@/core/effects/validation';
import { getProject } from '@/core/projects/projects';
import {
  completeGenerationUploadIntent,
  consumeGenerationUploadIntent,
  failGenerationUploadIntent,
  getCompletedIntentUploads,
} from '@/core/effects/generation-upload-intent';
import {
  linkGenerationAsset,
  linkGenerationInputAssetsByUrls,
  getProjectAssetUrls,
  recordUserAsset,
  type AssetType,
} from '@/core/workspace-lib/assets/user-assets';

export type SubmitEffectGenerationResult = {
  status: number;
  body: Record<string, unknown>;
};

export type SubmitEffectGenerationInput = {
  effectId: number;
  input?: unknown;
  projectId?: string | null;
  generationIntentId?: string | null;
  requireProject?: boolean;
  metadata?: Record<string, unknown>;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getReferencedUrls = (input: Record<string, unknown>) => {
  const urls: string[] = [];
  for (const key of ['image_urls', 'video_urls', 'audio_urls'] as const) {
    if (Array.isArray(input[key])) {
      urls.push(
        ...input[key].filter((item): item is string => typeof item === 'string')
      );
    }
  }
  for (const key of ['image_url', 'video_url', 'audio_url'] as const) {
    if (typeof input[key] === 'string') urls.push(input[key]);
  }
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
};

const assetTypeFromMime = (mimeType: string | null): AssetType => {
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('audio/')) return 'audio';
  return 'image';
};

async function finalizeIntentUploads({
  intentId,
  generationId,
}: {
  intentId: string;
  generationId: string;
}) {
  const uploads = await getCompletedIntentUploads({ intentId });
  for (const upload of uploads) {
    if (!upload.publicUrl || !upload.objectKey) continue;
    const assetId = await recordUserAsset({
      type: assetTypeFromMime(upload.mimeType),
      source: 'upload',
      assetClass: 'original',
      storageProvider: upload.storageProvider ?? 'beatapi',
      bucket: upload.bucket ?? upload.storageProvider ?? 'beatapi',
      objectKey: upload.objectKey,
      publicUrl: upload.publicUrl,
      filename: upload.filename ?? undefined,
      mimeType: upload.mimeType ?? undefined,
      sizeBytes: upload.sizeBytes ?? undefined,
      metadata: { generationIntentId: intentId },
    });
    await linkGenerationAsset({
      generationId,
      assetId,
      role: 'input',
    });
  }
  await completeGenerationUploadIntent({ intentId, generationId });
}

async function linkInputAssets(
  generationId: string,
  input: Record<string, unknown>
) {
  for (const key of ['image_urls', 'video_urls', 'audio_urls'] as const) {
    const urls = Array.isArray(input[key])
      ? input[key].filter((item): item is string => typeof item === 'string')
      : [];
    if (urls.length) {
      await linkGenerationInputAssetsByUrls({ generationId, urls });
    }
  }
}

export async function submitEffectGeneration({
  effectId,
  input,
  projectId,
  generationIntentId,
  requireProject = true,
  metadata,
}: SubmitEffectGenerationInput): Promise<SubmitEffectGenerationResult> {
  if (!Number.isFinite(effectId)) {
    return { status: 400, body: { error: 'effectId is required' } };
  }
  const effect = await getEffectById(effectId);
  if (!effect || !getWorkspaceEffectRegistryEntryByEffectId(effectId)) {
    return { status: 404, body: { error: 'Model not found' } };
  }
  if (effect.type !== 1 && effect.type !== 2) {
    return { status: 400, body: { error: 'Only image and video models are supported.' } };
  }

  const normalizedProjectId = projectId?.trim() || null;
  if (requireProject && !normalizedProjectId) {
    return { status: 400, body: { error: 'projectId is required' } };
  }
  if (normalizedProjectId && !(await getProject({ projectId: normalizedProjectId }))) {
    return { status: 404, body: { error: 'Project not found' } };
  }

  const rawInput = asObject(input);
  const { callBackUrl: _callback, callbackUrl: _callbackLower, ...safeInput } = rawInput;
  const prompt = validateGenerationPrompt(
    typeof safeInput.prompt === 'string' ? safeInput.prompt : '',
    {
      required: true,
      maxChars: getGenerationPromptMaxChars({
        modelId: effect.model,
        provider: effect.provider,
      }),
    }
  );
  if (!prompt.ok) {
    return {
      status: 400,
      body: {
        error:
          prompt.code === 'PROMPT_TOO_LONG'
            ? `Prompt must be ${prompt.maxChars} characters or fewer.`
            : 'Prompt is required.',
      },
    };
  }

  const adapterInput = { ...safeInput, prompt: prompt.trimmedPrompt };
  const normalizedIntentId = generationIntentId?.trim() || '';
  if (!normalizedProjectId || !normalizedIntentId) {
    return {
      status: 400,
      body: { error: 'A generation intent is required.' },
    };
  }
  const recordedInput = metadata
    ? { ...adapterInput, _source: metadata }
    : adapterInput;
  const admission = await withGenerationSubmissionLock<
    | { result: SubmitEffectGenerationResult }
    | { generationId: string }
  >(async () => {
    const [activeProjectId, runningCount] = await Promise.all([
      findActiveProject(),
      countRunningGenerationsForProject(normalizedProjectId),
    ]);
    const gate = resolveGenerationConcurrencyGate({
      requestedProjectId: normalizedProjectId,
      activeProjectId,
      runningCountForRequestedProject: runningCount,
    });
    if (!gate.ok) {
      return {
        result: {
          status: 429,
          body: {
            error: getGenerationConcurrencyErrorMessage(gate),
            code: gate.code,
            activeProjectId:
              gate.code === 'ANOTHER_PROJECT_RUNNING'
                ? gate.activeProjectId
                : undefined,
            limit:
              gate.code === 'PROJECT_CONCURRENCY_LIMIT'
                ? gate.limit
                : undefined,
          },
        } satisfies SubmitEffectGenerationResult,
      };
    }

    const referencedUrls = getReferencedUrls(adapterInput);
    const authorizedProjectUrls = await getProjectAssetUrls({
      projectId: normalizedProjectId,
      urls: referencedUrls,
    });
    const intent = await consumeGenerationUploadIntent({
      intentId: normalizedIntentId,
      projectId: normalizedProjectId,
      effectId,
      referencedUrls,
      authorizedProjectUrls,
    });
    if (!intent) {
      return {
        result: {
          status: 409,
          body: {
            error:
              'Generation intent is invalid, expired, incomplete, or already used.',
          },
        } satisfies SubmitEffectGenerationResult,
      };
    }

    const generationId = await recordGeneration({
      projectId: normalizedProjectId,
      effectId,
      status: 'pending',
      input: recordedInput,
    });
    if (!generationId) {
      await failGenerationUploadIntent({ intentId: normalizedIntentId });
      return {
        result: {
          status: 500,
          body: { error: 'Could not create generation.' },
        } satisfies SubmitEffectGenerationResult,
      };
    }
    return { generationId };
  });
  if ('result' in admission) return admission.result;
  const { generationId } = admission;

  try {
    await linkInputAssets(generationId, adapterInput);
    const result = await createAdapter(effect).createGeneration(adapterInput);
    const providerError = 'error' in result ? result.error ?? null : null;
    const transition = resolveGenerationSubmitTransition({
      generationId,
      providerStatus: result.status,
      providerTaskId: resolveProviderTaskId(result.output),
      providerOutput: result.output,
      providerError,
    });
    const output =
      result.status === 'succeeded'
        ? await persistEffectOutputIfNeeded({
            output: transition.output,
            wmTaskId: generationId,
            effectId,
            effectType: effect.type,
          })
        : transition.output;
    if (result.status === 'failed') {
      await failGenerationUploadIntent({ intentId: normalizedIntentId });
    } else {
      await finalizeIntentUploads({
        intentId: normalizedIntentId,
        generationId,
      });
    }
    await updateGenerationById({
      id: generationId,
      status: transition.publicStatus,
      output,
      error: transition.error,
    });
    if (transition.publicStatus === 'pending' || transition.publicStatus === 'processing') {
      startBackendPollingForGeneration({ wmTaskId: generationId, effectId });
    }
    return {
      status: 200,
      body: {
        success: transition.publicStatus === 'succeeded',
        status: transition.publicStatus,
        wmTaskId: generationId,
        output,
        error: transition.publicStatus === 'failed' ? providerError ?? 'Generation failed.' : null,
      },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Generation failed';
    await failGenerationUploadIntent({ intentId: normalizedIntentId });
    await updateGenerationById({ id: generationId, status: 'failed', error: message });
    return { status: 500, body: { error: message } };
  }
}
