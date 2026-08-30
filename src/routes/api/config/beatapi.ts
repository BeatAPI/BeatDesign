import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getConfig, saveConfigs } from '@/modules/config/service';
import { DEFAULT_BEATAPI_BASE_URL } from '@/core/beatcanvas/providers/provider-config';
import { maskApiKeyPreview } from '@/lib/mask-api-key';
import { validateTrustedLocalJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

/**
 * Workspace-level BeatAPI provider configuration. The dialog pre-fills the
 * official endpoint so a local user only has to paste an API key.
 */
async function GET({ request }: { request: Request }) {
  try {
    const apiKey = (await getConfig('BEATAPI_API_KEY')) || '';

    return respData({
      baseUrl: DEFAULT_BEATAPI_BASE_URL,
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
    if (!trust.ok) {
      return respErr(trust.message, trust.status);
    }
    const body = await readRequestJsonWithLimit<{ apiKey?: unknown }>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    ).catch((error) => {
      if (error instanceof RequestBodyTooLargeError) throw error;
      return null;
    });
    if (!body || typeof body !== 'object') return respErr('Invalid body');

    const next: Record<string, string> = {};
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      next.BEATAPI_API_KEY = body.apiKey.trim();
    }
    next.BEATAPI_API_BASE_URL = DEFAULT_BEATAPI_BASE_URL;

    const apiKey =
      next.BEATAPI_API_KEY ||
      (await getConfig('BEATAPI_API_KEY')) ||
      '';
    if (!apiKey) return respErr('BeatAPI API key is required', 400);

    const testResponse = await fetch(`${DEFAULT_BEATAPI_BASE_URL}/v1/usage`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!testResponse.ok) {
      return respErr('BeatAPI connection test failed', 400);
    }

    await saveConfigs(next);
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

export const Route = createFileRoute('/api/config/beatapi')({
  server: {
    handlers: { GET, POST },
  },
});
