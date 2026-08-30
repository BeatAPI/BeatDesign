import { readFile, stat } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';

import {
  detectUploadedMediaType,
  getCanonicalUploadedMediaMimeType,
  validateUploadedAudioFile,
  validateUploadedImageFile,
  validateUploadedVideoFile,
} from '@/core/effects/validation';
import { isSupportedRasterImage } from '@/lib/image-upload-validation';
import { getProject } from '@/core/projects/projects';
import {
  LOCAL_PROJECT_ASSET_BUCKET,
  LOCAL_PROJECT_ASSET_PROVIDER,
  persistLocalProjectAsset,
  removePersistedLocalProjectAsset,
} from '@/core/projects/local-project-assets';
import {
  deleteUserAssetById,
  linkProjectAsset,
  recordUserAsset,
} from '@/core/workspace-lib/assets/user-assets';

export function validateLocalAssetImportCandidate({
  filename,
  size,
}: {
  filename: string;
  size: number;
}) {
  const detectedFile = { name: filename, type: '', size };
  const mediaType = detectUploadedMediaType(detectedFile);
  if (!mediaType) throw new Error('Unsupported project asset type.');

  const mimeType = getCanonicalUploadedMediaMimeType(detectedFile);
  if (!mimeType) throw new Error('Unsupported project asset type.');
  const file = { ...detectedFile, type: mimeType };
  const validation =
    mediaType === 'image'
      ? validateUploadedImageFile(file)
      : mediaType === 'video'
        ? validateUploadedVideoFile(file)
        : validateUploadedAudioFile(file);
  if (!validation.ok) {
    throw new Error('Project asset type or size is not supported.');
  }

  return { mediaType, mimeType };
}

export async function importLocalProjectAsset({
  projectId,
  filePath,
}: {
  projectId: string;
  filePath: string;
}) {
  const trimmedPath = filePath.trim();
  if (!isAbsolute(trimmedPath)) {
    throw new Error('Asset import requires an absolute file path.');
  }
  const absolutePath = resolve(trimmedPath);
  const fileStat = await stat(absolutePath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error('Asset file was not found.');
  }
  const filename = basename(absolutePath);
  let candidate = validateLocalAssetImportCandidate({
    filename,
    size: fileStat.size,
  });
  const currentProject = await getProject({ projectId });
  if (!currentProject || currentProject.status !== 'active') {
    throw new Error('Project not found.');
  }

  const bytes = new Uint8Array(await readFile(absolutePath));
  if (bytes.byteLength !== fileStat.size) {
    candidate = validateLocalAssetImportCandidate({
      filename,
      size: bytes.byteLength,
    });
  }
  const { mediaType, mimeType } = candidate;
  if (mediaType === 'image' && !isSupportedRasterImage(mimeType, bytes)) {
    throw new Error('Image contents do not match a supported raster format.');
  }

  const persisted = await persistLocalProjectAsset({
    projectId,
    filename,
    mimeType,
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
      mimeType,
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
    return {
      id: assetId,
      type: mediaType,
      publicUrl: persisted.publicUrl,
      filename: persisted.filename,
      mimeType,
      sizeBytes: persisted.sizeBytes,
    };
  } catch (error) {
    await deleteUserAssetById(persisted.assetId).catch(() => undefined);
    await removePersistedLocalProjectAsset(persisted.filePath);
    throw error;
  }
}
