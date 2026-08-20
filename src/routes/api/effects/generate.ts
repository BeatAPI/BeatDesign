import { createFileRoute } from '@tanstack/react-router';
import { submitEffectGeneration } from '@/core/effects/submit-generation';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';

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
    payload = (await request.json()) as GenerateRequest;
  } catch {
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
