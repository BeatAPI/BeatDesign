import { createFileRoute } from '@tanstack/react-router';
import { normalizeAssetFirstGenerationRequest } from '@/core/commands/generation-contract';
import { createAssetFirstGenerationIntent } from '@/core/generation-providers/submit';
import { expireGenerationUploadIntents, GenerationIntentQuotaError } from '@/core/effects/generation-upload-intent';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

async function POST({ request }: { request: Request }) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }
  let payload: { generation?: unknown };
  try {
    payload = await readRequestJsonWithLimit(request, MAX_WORKSPACE_JSON_REQUEST_BYTES);
  } catch (error) {
    return Response.json({ error: error instanceof RequestBodyTooLargeError ? 'Request body is too large' : 'Invalid JSON' }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }
  try {
    const generation = normalizeAssetFirstGenerationRequest(payload?.generation);
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 500,
      keyPrefix: 'generation-precheck',
      extraKey: generation.projectId,
      includeCookie: false,
    });
    if (limited) return limited;
    await expireGenerationUploadIntents();
    const uploadIntentToken = await createAssetFirstGenerationIntent(generation);
    return Response.json({ success: true, uploadIntentToken });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid generation request.' },
      { status: error instanceof GenerationIntentQuotaError ? 429 : 400 }
    );
  }
}

export const Route = createFileRoute('/api/effects/precheck')({
  server: { handlers: { POST } },
});
