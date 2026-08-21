import { createFileRoute } from '@tanstack/react-router';

import { getConfig } from '@/modules/config/service';
import {
  claimGenerationUploadSlot,
  completeGenerationUploadSlot,
  getGenerationUploadIntentEffectId,
  releaseGenerationUploadSlot,
} from '@/core/effects/generation-upload-intent';
import { getWorkspaceEffectRegistryEntryByEffectId } from '@/core/effects/effect-registry';
import { S3Provider } from '@/core/workspace-storage/provider/s3';
import type { StorageConfig } from '@/core/workspace-storage/types';
import { DEFAULT_BEATAPI_BASE_URL } from '@/core/beatcanvas/providers/provider-config';
import { validateStorageEndpoint } from '@/core/workspace-storage/endpoint-policy';
import {
  readRequestFormDataWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';
import { readResponseJsonWithLimit } from '@/lib/response-body-limit';
import { isPublicHttpMediaUrl } from '@/core/effects/beatapi-media-url';

const MAX_DEFAULT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_MOTION_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES = 100 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const MAX_PROVIDER_JSON_BYTES = 1024 * 1024;
const BEATAPI_UPLOAD_TIMEOUT_MS = 120_000;
const BEATAPI_UPLOAD_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
  'audio/mp4',
  'application/x-subrip',
  'video/mp4',
  'video/quicktime',
]);

const MOTION_CONTROL_MODELS = new Set([
  'kling-2.6-motion-control',
  'kling-3-motion-control',
]);

const CUSTOM_STORAGE_TYPES = new Set([
  ...BEATAPI_UPLOAD_TYPES,
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const readErrorMessage = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const root = value as Record<string, unknown>;
  const error =
    root.error && typeof root.error === 'object'
      ? (root.error as Record<string, unknown>)
      : null;
  return typeof error?.message === 'string'
    ? error.message
    : typeof root.message === 'string'
      ? root.message
      : null;
};

async function uploadToBeatApi(file: File) {
  const apiKey = await getConfig('BEATAPI_API_KEY');
  if (!apiKey) throw new Error('Connect a BeatAPI API key before uploading files');

  const formData = new FormData();
  formData.set('file', file, file.name);
  formData.set('purpose', 'input');
  const response = await fetch(
    `${DEFAULT_BEATAPI_BASE_URL}/v1/files`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(BEATAPI_UPLOAD_TIMEOUT_MS),
    }
  );
  const payload = await readResponseJsonWithLimit(
    response,
    MAX_PROVIDER_JSON_BYTES
  );
  if (!response.ok) {
    throw new Error(readErrorMessage(payload) || 'BeatAPI file upload failed');
  }
  const data =
    payload && typeof payload === 'object'
      ? (payload as { data?: Record<string, unknown> }).data
      : null;
  const url = typeof data?.url === 'string' ? data.url : null;
  const key = typeof data?.key === 'string' ? data.key : null;
  const id = typeof data?.id === 'string' ? data.id : key;
  if (!url || !id || !isPublicHttpMediaUrl(url)) {
    throw new Error('BeatAPI upload response is incomplete');
  }
  return { url, key: key || id, provider: 'beatapi' as const };
}

async function loadCustomStorageConfig(): Promise<StorageConfig | null> {
  const [
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    legacyVideoBucket,
    publicUrl,
    legacyVideoPublicUrl,
    forcePathStyle,
  ] = await Promise.all([
    getConfig('R2_REGION'),
    getConfig('R2_ENDPOINT'),
    getConfig('R2_ACCESS_KEY_ID'),
    getConfig('R2_SECRET_ACCESS_KEY'),
    getConfig('R2_BUCKET_NAME'),
    getConfig('R2_VIDEO_BUCKET_NAME'),
    getConfig('R2_PUBLIC_URL'),
    getConfig('R2_VIDEO_PUBLIC_URL'),
    getConfig('R2_FORCE_PATH_STYLE'),
  ]);
  const resolvedBucket = bucketName || legacyVideoBucket;
  const resolvedPublicUrl = publicUrl || legacyVideoPublicUrl;
  if (
    !endpoint ||
    !accessKeyId ||
    !secretAccessKey ||
    !resolvedBucket ||
    !resolvedPublicUrl
  ) {
    return null;
  }
  const endpointPolicy = validateStorageEndpoint(endpoint, {
    allowPrivate:
      process.env.WORKSPACE_ALLOW_PRIVATE_STORAGE_ENDPOINTS === 'true',
  });
  if (!endpointPolicy.ok) throw new Error(endpointPolicy.message);
  return {
    region: region || 'auto',
    endpoint: endpointPolicy.endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName: resolvedBucket,
    publicUrl: resolvedPublicUrl,
    forcePathStyle: forcePathStyle !== 'false',
  };
}

async function loadManagedStorageConfig(): Promise<StorageConfig | null> {
  const config = {
    region: process.env.BEATAPI_MANAGED_R2_REGION || 'auto',
    endpoint: process.env.BEATAPI_MANAGED_R2_ENDPOINT || '',
    accessKeyId: process.env.BEATAPI_MANAGED_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.BEATAPI_MANAGED_R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.BEATAPI_MANAGED_R2_BUCKET_NAME || '',
    publicUrl: process.env.BEATAPI_MANAGED_R2_PUBLIC_URL || '',
    forcePathStyle:
      process.env.BEATAPI_MANAGED_R2_FORCE_PATH_STYLE !== 'false',
  };
  if (
    !config.endpoint ||
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.bucketName ||
    !config.publicUrl
  ) {
    return null;
  }
  return config;
}

async function uploadToS3Storage({
  file,
  config,
  provider,
}: {
  file: File;
  config: StorageConfig | null;
  provider: 'beatapi' | 's3';
}) {
  if (!config) {
    throw new Error(
      provider === 'beatapi'
        ? 'Managed video input storage is not configured on this deployment. Use your own R2/S3 or configure BeatAPI managed R2.'
        : 'Configure your own Cloudflare R2/S3 connection before generating with local references.'
    );
  }
  const folder = file.type.startsWith('video/')
    ? 'workspace/videos'
    : file.type.startsWith('audio/')
      ? 'workspace/audio'
      : 'workspace/images';
  const result = await new S3Provider(config).uploadFile({
    file,
    filename: file.name,
    contentType: file.type,
    folder,
  });
  return { ...result, provider } as const;
}

async function POST({ request }: { request: Request }) {
  try {
    const authorizedProjectId = request.headers
      .get('x-beatapi-project-id')
      ?.trim();
    const authorizedIntent = request.headers
      .get('x-beatapi-generation-intent')
      ?.trim();
    if (!authorizedProjectId || !authorizedIntent) {
      return Response.json(
        { error: 'A confirmed generation is required before managed upload' },
        { status: 403 }
      );
    }
    const formData = await readRequestFormDataWithLimit(
      request,
      MAX_VIDEO_FILE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
    );
    const file = formData.get('file');
    const projectId = formData.get('projectId');
    const generationIntentToken = formData.get('generationIntentToken');
    if (!(file instanceof File)) {
      return Response.json({ error: 'file is required' }, { status: 400 });
    }
    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
    const defaultMaxFileBytes = isVideo
      ? MAX_VIDEO_FILE_BYTES
      : MAX_DEFAULT_FILE_BYTES;
    if (file.size <= 0 || file.size > defaultMaxFileBytes) {
      return Response.json(
        {
          error: `File must be between 1 byte and ${
            defaultMaxFileBytes / (1024 * 1024)
          } MB`,
        },
        { status: 413 }
      );
    }

    if (
      typeof projectId !== 'string' ||
      projectId.trim() !== authorizedProjectId ||
      typeof generationIntentToken !== 'string' ||
      generationIntentToken.trim() !== authorizedIntent
    ) {
      return Response.json(
        { error: 'A confirmed generation is required before managed upload' },
        { status: 403 }
      );
    }
    const apiKey = await getConfig('BEATAPI_API_KEY');
    if (!apiKey) {
      return Response.json(
        { error: 'Generation upload authorization is invalid or expired' },
        { status: 403 }
      );
    }

    const normalizedProjectId = authorizedProjectId;
    const intentEffectId = await getGenerationUploadIntentEffectId({
      intentId: authorizedIntent,
      projectId: normalizedProjectId,
    });
    const intentModel = intentEffectId
      ? getWorkspaceEffectRegistryEntryByEffectId(intentEffectId)?.id
      : null;
    const isMotionControl = Boolean(
      intentModel && MOTION_CONTROL_MODELS.has(intentModel)
    );
    if (
      isMotionControl &&
      !isVideo &&
      file.size > MAX_MOTION_IMAGE_BYTES
    ) {
      return Response.json(
        { error: 'Kling Motion Control images must be 10 MB or smaller' },
        { status: 413 }
      );
    }
    const slotId = await claimGenerationUploadSlot({
      intentId: authorizedIntent,
      projectId: normalizedProjectId,
    });
    if (!slotId) {
      return Response.json(
        { error: 'Generation upload authorization is invalid, expired, or already used' },
        { status: 403 }
      );
    }

    const storageMode =
      (await getConfig('WORKSPACE_STORAGE_MODE')) === 's3' ? 's3' : 'beatapi';
    const isSubtitle =
      file.type === 'text/plain' && file.name.toLowerCase().endsWith('.srt');
    const canUseBeatApi = BEATAPI_UPLOAD_TYPES.has(file.type) || isSubtitle;
    const canUseCustomStorage = CUSTOM_STORAGE_TYPES.has(file.type) || isSubtitle;
    let result: {
      url: string;
      key: string;
      provider: 'beatapi' | 's3';
    } | null = null;
    try {
      result =
        isMotionControl
          ? canUseBeatApi
            ? await uploadToBeatApi(file)
            : null
          : storageMode === 's3'
          ? canUseCustomStorage
            ? await uploadToS3Storage({
                file,
                config: await loadCustomStorageConfig(),
                provider: 's3',
              })
            : null
          : canUseBeatApi
            ? await uploadToBeatApi(file)
            : file.type.startsWith('video/')
              ? await uploadToS3Storage({
                  file,
                  config: await loadManagedStorageConfig(),
                  provider: 'beatapi',
                })
              : null;
      if (!result) {
        await releaseGenerationUploadSlot({
          intentId: authorizedIntent,
          slotId,
        });
        return Response.json({ error: 'Unsupported file type' }, { status: 415 });
      }

      const completed = await completeGenerationUploadSlot({
        intentId: authorizedIntent,
        upload: {
          slotId,
          provider: result.provider,
          bucket: result.provider,
          key: result.key,
          url: result.url,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });
      if (!completed) {
        throw new Error('Generation upload authorization expired before completion');
      }
    } catch (error) {
      await releaseGenerationUploadSlot({
        intentId: authorizedIntent,
        slotId,
      }).catch(() => undefined);
      throw error;
    }

    return Response.json({
      url: result.url,
      key: result.key,
      provider: result.provider,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { error: 'Upload request exceeds the 100 MB video limit' },
        { status: 413 }
      );
    }
    console.error('workspace upload failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'File upload failed' },
      { status: 400 }
    );
  }
}

export const Route = createFileRoute('/api/storage/upload')({
  server: { handlers: { POST } },
});
