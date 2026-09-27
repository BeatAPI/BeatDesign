import { createFileRoute } from '@tanstack/react-router';

import {
  DEFAULT_16688_API_BASE_URL,
  DEFAULT_16688_MEDIA_GATEWAY_BASE_URL,
} from '@/core/adapters/newapi-16688-adapter';
import { normalizeMediaGatewayBaseUrl } from '@/core/adapters/media-gateway-url';
import { maskApiKeyPreview } from '@/lib/mask-api-key';
import { readRequestJsonWithLimit, RequestBodyTooLargeError, MAX_WORKSPACE_JSON_REQUEST_BYTES } from '@/lib/request-body-limit';
import { respData, respErr } from '@/lib/resp';
import { validateTrustedLocalJsonMutation } from '@/lib/trusted-local-request';
import { getConfig, saveConfigs } from '@/modules/config/service';

async function GET() {
  try {
    const apiKey = (await getConfig('NEWAPI_API_KEY')) || '';
    const mediaApiKey = (await getConfig('MEDIA_GATEWAY_API_KEY')) || '';
    const mediaBaseUrl =
      (await getConfig('MEDIA_GATEWAY_BASE_URL')) ||
      DEFAULT_16688_MEDIA_GATEWAY_BASE_URL;
    return respData({
      baseUrl: DEFAULT_16688_API_BASE_URL,
      apiKeyConfigured: Boolean(apiKey),
      apiKeyPreview: apiKey ? maskApiKeyPreview(apiKey) : '',
      mediaGateway: {
        baseUrl: mediaBaseUrl,
        apiKeyConfigured: Boolean(mediaApiKey),
        apiKeyPreview: mediaApiKey ? maskApiKeyPreview(mediaApiKey) : '',
      },
    });
  } catch {
    return respErr('Internal error', 500);
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const trust = validateTrustedLocalJsonMutation(request, {
      allowRemote: process.env.BEATDESIGN_ALLOW_REMOTE_SETTINGS === '1',
    });
    if (!trust.ok) return respErr(trust.message, trust.status);

    const body = await readRequestJsonWithLimit<{
      apiKey?: unknown;
      mediaBaseUrl?: unknown;
      mediaApiKey?: unknown;
    }>(
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
    const submittedMediaKey =
      typeof body.mediaApiKey === 'string' ? body.mediaApiKey.trim() : '';
    const mediaApiKey =
      submittedMediaKey || (await getConfig('MEDIA_GATEWAY_API_KEY')) || '';
    const submittedMediaBaseUrl =
      typeof body.mediaBaseUrl === 'string' ? body.mediaBaseUrl.trim() : '';
    let mediaBaseUrl =
      submittedMediaBaseUrl ||
      (await getConfig('MEDIA_GATEWAY_BASE_URL')) ||
      DEFAULT_16688_MEDIA_GATEWAY_BASE_URL;
    try {
      mediaBaseUrl = normalizeMediaGatewayBaseUrl(mediaBaseUrl, {
        allowedHttpHosts: (
          process.env.BEATDESIGN_MEDIA_GATEWAY_HTTP_HOSTS || ''
        )
          .split(',')
          .filter(Boolean),
      });
    } catch (error) {
      return respErr(
        error instanceof Error ? error.message : 'Invalid media gateway URL',
        400
      );
    }
    if (!apiKey && !mediaApiKey) {
      return respErr('Connect at least one 16688 generation channel', 400);
    }

    if (submittedKey) {
      const response = await fetch(`${DEFAULT_16688_API_BASE_URL}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return respErr('16688 AI connection test failed', 400);
    }
    if (submittedMediaKey || submittedMediaBaseUrl) {
      if (!mediaApiKey) return respErr('Gemini media gateway key is required', 400);
      const response = await fetch(`${mediaBaseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${mediaApiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return respErr('Gemini media gateway connection test failed', 400);
      }
    }

    await saveConfigs({
      ...(submittedKey ? { NEWAPI_API_KEY: submittedKey } : {}),
      NEWAPI_API_BASE_URL: DEFAULT_16688_API_BASE_URL,
      ...(submittedMediaKey
        ? { MEDIA_GATEWAY_API_KEY: submittedMediaKey }
        : {}),
      ...(submittedMediaBaseUrl
        ? { MEDIA_GATEWAY_BASE_URL: mediaBaseUrl }
        : {}),
    });
    return respData({
      ok: true,
      connected: true,
      apiKeyPreview: apiKey ? maskApiKeyPreview(apiKey) : '',
      mediaApiKeyPreview: mediaApiKey
        ? maskApiKeyPreview(mediaApiKey)
        : '',
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
