import { createFileRoute } from '@tanstack/react-router';

import { DEFAULT_16688_API_BASE_URL } from '@/core/adapters/newapi-16688-adapter';
import { maskApiKeyPreview } from '@/lib/mask-api-key';
import { readRequestJsonWithLimit, RequestBodyTooLargeError, MAX_WORKSPACE_JSON_REQUEST_BYTES } from '@/lib/request-body-limit';
import { respData, respErr } from '@/lib/resp';
import { validateTrustedLocalJsonMutation } from '@/lib/trusted-local-request';
import { getConfig, saveConfigs } from '@/modules/config/service';

async function GET() {
  try {
    const apiKey = (await getConfig('NEWAPI_API_KEY')) || '';
    return respData({
      baseUrl: DEFAULT_16688_API_BASE_URL,
      apiKeyConfigured: Boolean(apiKey),
      apiKeyPreview: apiKey ? maskApiKeyPreview(apiKey) : '',
    });
  } catch {
    return respErr('Internal error', 500);
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const trust = validateTrustedLocalJsonMutation(request);
    if (!trust.ok) return respErr(trust.message, trust.status);

    const body = await readRequestJsonWithLimit<{ apiKey?: unknown }>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    ).catch((error) => {
      if (error instanceof RequestBodyTooLargeError) throw error;
      return null;
    });
    if (!body || typeof body !== 'object') return respErr('Invalid body');

    const submittedKey =
      typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const apiKey = submittedKey || (await getConfig('NEWAPI_API_KEY')) || '';
    if (!apiKey) return respErr('16688 AI API key is required', 400);

    const response = await fetch(`${DEFAULT_16688_API_BASE_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return respErr('16688 AI connection test failed', 400);

    await saveConfigs({
      ...(submittedKey ? { NEWAPI_API_KEY: submittedKey } : {}),
      NEWAPI_API_BASE_URL: DEFAULT_16688_API_BASE_URL,
    });
    return respData({
      ok: true,
      connected: true,
      apiKeyPreview: maskApiKeyPreview(apiKey),
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return respErr('Request body is too large', 413);
    }
    return respErr('Internal error', 500);
  }
}

export const Route = createFileRoute('/api/config/16688')({
  server: { handlers: { GET, POST } },
});
