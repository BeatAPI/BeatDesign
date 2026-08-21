import { createFileRoute } from '@tanstack/react-router';
import { submitEffectGeneration } from '@/core/effects/submit-generation';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

type GenerateRequest = {
  effectId?: number;
  input?: unknown;
  projectId?: string;
  generationIntentToken?: string;
};

async function POST({ request }: { request: Request }) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  let payload: GenerateRequest;
  try {
    payload = await readRequestJsonWithLimit<GenerateRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const result = await submitEffectGeneration({
    effectId: payload.effectId ?? Number.NaN,
    input: payload.input,
    projectId: payload.projectId,
    generationIntentId: payload.generationIntentToken,
  });
  return Response.json(result.body, { status: result.status });
}

export const Route = createFileRoute('/api/effects/generate')({
  server: { handlers: { POST } },
});
