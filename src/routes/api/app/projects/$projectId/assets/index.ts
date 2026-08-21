import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import {
  detectUploadedMediaType,
  getCanonicalUploadedMediaMimeType,
  validateUploadedImageFile,
  validateUploadedVideoFile,
  REFERENCE_VIDEO_MAX_FILE_SIZE,
} from '@/core/effects/validation';
import {
  LOCAL_PROJECT_ASSET_BUCKET,
  LOCAL_PROJECT_ASSET_PROVIDER,
  persistLocalProjectAsset,
  removePersistedLocalProjectAsset,
} from '@/core/projects/local-project-assets';
import { getProject } from '@/core/projects/projects';
import {
  deleteUserAssetById,
  linkProjectAsset,
  recordUserAsset,
} from '@/core/workspace-lib/assets/user-assets';
import {
  readRequestFormDataWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';
import { isSupportedRasterImage } from '@/lib/image-upload-validation';
import { validateTrustedWorkspaceMutation } from '@/lib/trusted-local-request';

const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

async function POST({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const trust = validateTrustedWorkspaceMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return Response.json(
      { error: 'Project asset uploads must use multipart/form-data.' },
      { status: 415 }
    );
  }
  if (envConfigs.database_provider !== 'sqlite') {
    return Response.json(
      {
        error:
          'Local project assets are only available in local SQLite mode. Configure R2/S3 on hosted deployments.',
      },
      { status: 501 }
    );
  }

  const { projectId } = params;
  const currentProject = await getProject({ projectId });
  if (!currentProject || currentProject.status !== 'active') {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const formData = await readRequestFormDataWithLimit(
      request,
      REFERENCE_VIDEO_MAX_FILE_SIZE + MAX_MULTIPART_OVERHEAD_BYTES
    );
    const file = formData.get('file');
    if (!(file instanceof File) || file.size <= 0) {
      return Response.json({ error: 'A non-empty file is required' }, { status: 400 });
    }

    const mediaType = detectUploadedMediaType(file);
    if (!mediaType) {
      return Response.json({ error: 'Unsupported project asset type' }, { status: 415 });
    }
    const validation =
      mediaType === 'image'
        ? validateUploadedImageFile(file)
        : validateUploadedVideoFile(file);
    if (!validation.ok) {
      return Response.json(
        { error: 'Project asset type or size is not supported' },
        { status: validation.code.endsWith('TOO_LARGE') ? 413 : 415 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const persistedMimeType = getCanonicalUploadedMediaMimeType(file);
    if (!persistedMimeType) {
      return Response.json({ error: 'Unsupported project asset type' }, { status: 415 });
    }
    if (
      mediaType === 'image' &&
      !isSupportedRasterImage(persistedMimeType, bytes)
    ) {
      return Response.json(
        { error: 'Image contents do not match a supported raster format' },
        { status: 415 }
      );
    }

    const persisted = await persistLocalProjectAsset({
      projectId,
      filename: file.name,
      mimeType: persistedMimeType,
      bytes,
    });

    try {
      const assetId = await recordUserAsset({
        id: persisted.assetId,
        type: mediaType,
        source: 'upload',
        bucket: LOCAL_PROJECT_ASSET_BUCKET,
        objectKey: persisted.objectKey,
        publicUrl: persisted.publicUrl,
        mimeType: persistedMimeType,
        sizeBytes: persisted.sizeBytes,
        sha256: persisted.sha256,
        filename: persisted.filename,
        storageProvider: LOCAL_PROJECT_ASSET_PROVIDER,
        assetClass: 'original',
        originProjectId: projectId,
      });
      await linkProjectAsset({
        projectId,
        assetId,
        role: 'upload',
      });

      return Response.json({
        asset: {
          id: assetId,
          type: mediaType,
          publicUrl: persisted.publicUrl,
          filename: persisted.filename,
          mimeType: persistedMimeType,
          sizeBytes: persisted.sizeBytes,
        },
      });
    } catch (error) {
      await deleteUserAssetById(persisted.assetId).catch(() => undefined);
      await removePersistedLocalProjectAsset(persisted.filePath);
      throw error;
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { error: 'Project asset exceeds the local upload limit' },
        { status: 413 }
      );
    }
    console.error('local project asset upload failed:', error);
    return Response.json(
      { error: 'Project asset upload failed' },
      { status: 400 }
    );
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/assets/'
)({
  server: { handlers: { POST } },
});
