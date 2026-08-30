import { createFileRoute } from '@tanstack/react-router';
import { getEffectById } from '@/core/effects/effects';
import { getWorkspaceEffectRegistryEntryByEffectId } from '@/core/effects/effect-registry';
import { isVideoAnalysisEffectId } from '@/core/effects/video-analysis';
import {
  getGenerationConcurrencyErrorMessage,
  resolveGenerationConcurrencyGate,
} from '@/core/effects/generation-concurrency';
import {
  countRunningGenerationsForProject,
  findActiveProject,
} from '@/core/effects/record-generation';
import { getGenerationPromptConstraints, validateGenerationPrompt } from '@/core/effects/validation';
import { getProject } from '@/core/projects/projects';
import { getGenerationProvider } from '@/core/generation-providers';
import {
  expireGenerationUploadIntents,
  GenerationIntentQuotaError,
  issueGenerationUploadIntent,
  normalizeExpectedUploadCount,
} from '@/core/effects/generation-upload-intent';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

type PrecheckRequest = {
  effectId?: number;
  input?: unknown;
  projectId?: string;
  expectedUploadCount?: unknown;
};

async function POST({ request }: { request: Request }) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  let payload: PrecheckRequest;
  try {
    payload = await readRequestJsonWithLimit<PrecheckRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const effectId = payload.effectId ?? Number.NaN;
  const effect = Number.isFinite(effectId) ? await getEffectById(effectId) : null;
  if (
    !effect ||
    (!getWorkspaceEffectRegistryEntryByEffectId(effectId) &&
      !isVideoAnalysisEffectId(effectId))
  ) {
    return Response.json({ error: 'Model not found' }, { status: 404 });
  }
  const projectId = payload.projectId?.trim();
  if (!projectId) return Response.json({ error: 'projectId is required' }, { status: 400 });
  if (!(await getProject({ projectId }))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const rateLimitResponse = enforceMinIntervalRateLimit(request, {
    intervalMs: 500,
    keyPrefix: 'generation-precheck',
    extraKey: projectId,
    includeCookie: false,
  });
  if (rateLimitResponse) return rateLimitResponse;
  const [activeProjectId, runningCountForRequestedProject] = await Promise.all([
    findActiveProject(),
    countRunningGenerationsForProject(projectId),
  ]);
  const gate = resolveGenerationConcurrencyGate({
    requestedProjectId: projectId,
    activeProjectId,
    runningCountForRequestedProject,
  });
  if (!gate.ok) {
    return Response.json(
      { error: getGenerationConcurrencyErrorMessage(gate), code: gate.code },
      { status: 429 }
    );
  }
  const input = payload.input && typeof payload.input === 'object'
    ? (payload.input as Record<string, unknown>)
    : {};
  const promptConstraints = getGenerationPromptConstraints({
    modelId: effect.model,
    provider: effect.provider,
  });
  const prompt = validateGenerationPrompt(
    typeof input.prompt === 'string' ? input.prompt : '',
    promptConstraints
  );
  if (!prompt.ok) {
    return Response.json({ error: prompt.code === 'PROMPT_TOO_LONG'
      ? `Prompt must be ${prompt.maxChars} characters or fewer.`
      : 'Prompt is required.' }, { status: 400 });
  }
  const provider = getGenerationProvider(effect.provider);
  if (!provider) {
    return Response.json(
      { error: `Generation provider ${effect.provider} is not registered.` },
      { status: 400 }
    );
  }
  try {
    await provider.assertConfigured?.();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation provider is not configured.' },
      { status: 400 }
    );
  }
  const expectedUploadCount = normalizeExpectedUploadCount(
    payload.expectedUploadCount
  );
  if (expectedUploadCount === null) {
    return Response.json(
      { error: 'Invalid generation upload count.' },
      { status: 400 }
    );
  }
  if (expectedUploadCount === 0) {
    try {
      provider.validateInput?.(effect, {
        ...input,
        prompt: prompt.trimmedPrompt,
      });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Invalid generation model parameters.',
        },
        { status: 400 }
      );
    }
  }
  await expireGenerationUploadIntents();
  try {
    return Response.json({
      success: true,
      uploadIntentToken: await issueGenerationUploadIntent({
        projectId,
        effectId,
        expectedUploadCount,
      }),
    });
  } catch (error) {
    if (error instanceof GenerationIntentQuotaError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
}

export const Route = createFileRoute('/api/effects/precheck')({
  server: { handlers: { POST } },
});
