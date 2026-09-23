import { createFileRoute } from '@tanstack/react-router';
import { submitAssetFirstGeneration } from '@/core/generation-providers/submit';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import { MAX_WORKSPACE_JSON_REQUEST_BYTES, readRequestJsonWithLimit, RequestBodyTooLargeError } from '@/lib/request-body-limit';

async function POST({ request }: { request: Request }) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) return Response.json({ error: trust.message }, { status: trust.status });
  try {
    const payload = await readRequestJsonWithLimit<{
      generation: unknown; generationIntentToken?: string;
    }>(request, MAX_WORKSPACE_JSON_REQUEST_BYTES);
    if (!payload.generation) return Response.json({ error: 'An asset-first generation request is required.' }, { status: 400 });
    const result = await submitAssetFirstGeneration({
      generation: payload.generation,
      generationIntentId: payload.generationIntentToken,
      origin: 'ui',
    });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Generation failed.' }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400,
    });
  }
}
export const Route = createFileRoute('/api/effects/generate')({ server: { handlers: { POST } } });
