import { createFileRoute } from '@tanstack/react-router';

import { respData, respErr } from '@/lib/resp';
import { getConfig, saveConfigs } from '@/modules/config/service';
import { validateTrustedLocalJsonMutation } from '@/lib/trusted-local-request';
import { validateStorageEndpoint } from '@/core/workspace-storage/endpoint-policy';

type StorageMode = 'beatapi' | 's3';

function normalizeMode(value: string | undefined): StorageMode {
  return value === 's3' ? 's3' : 'beatapi';
}

async function GET() {
  try {
    const [
      mode,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
      forcePathStyle,
    ] = await Promise.all([
      getConfig('WORKSPACE_STORAGE_MODE'),
      getConfig('R2_REGION'),
      getConfig('R2_ENDPOINT'),
      getConfig('R2_ACCESS_KEY_ID'),
      getConfig('R2_SECRET_ACCESS_KEY'),
      getConfig('R2_BUCKET_NAME'),
      getConfig('R2_PUBLIC_URL'),
      getConfig('R2_FORCE_PATH_STYLE'),
    ]);

    return respData({
      mode: normalizeMode(mode),
      managedEligible: true,
      custom: {
        region: region || 'auto',
        endpoint: endpoint || '',
        bucketName: bucketName || '',
        publicUrl: publicUrl || '',
        forcePathStyle: forcePathStyle !== 'false',
        accessKeyConfigured: Boolean(accessKeyId),
        secretKeyConfigured: Boolean(secretAccessKey),
      },
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

    const body = (await request.json().catch(() => null)) as
      | {
          mode?: unknown;
          region?: unknown;
          endpoint?: unknown;
          accessKeyId?: unknown;
          secretAccessKey?: unknown;
          bucketName?: unknown;
          publicUrl?: unknown;
          forcePathStyle?: unknown;
        }
      | null;
    if (!body || (body.mode !== 'beatapi' && body.mode !== 's3')) {
      return respErr('Storage mode must be beatapi or s3', 400);
    }

    const mode = body.mode as StorageMode;
    const next: Record<string, string> = {
      WORKSPACE_STORAGE_MODE: mode,
    };

    if (mode === 's3') {
      const [currentEndpoint, currentRegion, currentBucket] = await Promise.all([
        getConfig('R2_ENDPOINT'),
        getConfig('R2_REGION'),
        getConfig('R2_BUCKET_NAME'),
      ]);
      const textFields = {
        R2_REGION: body.region,
        R2_ENDPOINT: body.endpoint,
        R2_BUCKET_NAME: body.bucketName,
        R2_PUBLIC_URL: body.publicUrl,
      } as const;
      for (const [key, value] of Object.entries(textFields)) {
        if (typeof value === 'string' && value.trim()) next[key] = value.trim();
      }
      if (typeof body.accessKeyId === 'string' && body.accessKeyId.trim()) {
        next.R2_ACCESS_KEY_ID = body.accessKeyId.trim();
      }
      if (
        typeof body.secretAccessKey === 'string' &&
        body.secretAccessKey.trim()
      ) {
        next.R2_SECRET_ACCESS_KEY = body.secretAccessKey.trim();
      }
      next.R2_FORCE_PATH_STYLE = body.forcePathStyle === false ? 'false' : 'true';

      const authorityFields: Array<[keyof typeof next, string | undefined]> = [
        ['R2_ENDPOINT', currentEndpoint],
        ['R2_REGION', currentRegion],
        ['R2_BUCKET_NAME', currentBucket],
      ];
      const authorityChanged = authorityFields.some(
        ([key, current]) =>
          typeof next[key] === 'string' && next[key] !== (current || '')
      );
      if (
        authorityChanged &&
        (!next.R2_ACCESS_KEY_ID || !next.R2_SECRET_ACCESS_KEY)
      ) {
        return respErr(
          'Re-enter both storage credentials when endpoint, region, or bucket changes',
          400
        );
      }

      const required = await Promise.all(
        [
          ['R2_ENDPOINT', 'endpoint'],
          ['R2_ACCESS_KEY_ID', 'access key ID'],
          ['R2_SECRET_ACCESS_KEY', 'secret access key'],
          ['R2_BUCKET_NAME', 'bucket name'],
          ['R2_PUBLIC_URL', 'public URL'],
        ].map(async ([key, label]) => ({
          label,
          value: next[key] || (await getConfig(key)),
        }))
      );
      const missing = required.filter((item) => !item.value).map((item) => item.label);
      if (missing.length > 0) {
        return respErr(`Missing custom storage ${missing.join(', ')}`, 400);
      }

      const endpoint = next.R2_ENDPOINT || currentEndpoint || '';
      const endpointPolicy = validateStorageEndpoint(endpoint, {
        allowPrivate:
          process.env.WORKSPACE_ALLOW_PRIVATE_STORAGE_ENDPOINTS === 'true',
      });
      if (!endpointPolicy.ok) {
        return respErr(endpointPolicy.message, 400);
      }
      next.R2_ENDPOINT = endpointPolicy.endpoint;

      const publicUrl = next.R2_PUBLIC_URL || (await getConfig('R2_PUBLIC_URL')) || '';
      let parsedPublicUrl: URL;
      try {
        parsedPublicUrl = new URL(publicUrl);
      } catch {
        return respErr('Custom storage public URL is invalid', 400);
      }
      if (
        parsedPublicUrl.protocol !== 'https:' ||
        parsedPublicUrl.username ||
        parsedPublicUrl.password
      ) {
        return respErr('Custom storage public URL must use HTTPS', 400);
      }
    }

    await saveConfigs(next);
    return respData({ ok: true, mode });
  } catch {
    return respErr('Internal error', 500);
  }
}

export const Route = createFileRoute('/api/config/storage')({
  server: { handlers: { GET, POST } },
});
