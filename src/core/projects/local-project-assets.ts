import { createHash, randomUUID } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const LOCAL_PROJECT_ASSET_BUCKET = 'local-project-assets';
export const LOCAL_PROJECT_ASSET_PROVIDER = 'local';

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]{1,128}$/;
const MAX_FILENAME_LENGTH = 120;

const extensionForMimeType = (mimeType: string) => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('quicktime')) return '.mov';
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('mp4')) return '.mp4';
  if (normalized.includes('mpeg')) return '.mp3';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('m4a')) return '.m4a';
  if (normalized.includes('aac')) return '.aac';
  if (normalized.includes('ogg')) return '.ogg';
  return '';
};

export const getLocalProjectAssetRoot = (workspaceRoot = process.cwd()) =>
  resolve(workspaceRoot, 'data', 'project-assets');

export const sanitizeLocalProjectAssetFilename = ({
  filename,
  mimeType,
}: {
  filename: string;
  mimeType: string;
}) => {
  const source = basename(filename.trim() || 'asset')
    .normalize('NFKC')
    .replace(/^\.+/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_FILENAME_LENGTH);
  const fallback = `asset${extensionForMimeType(mimeType)}`;
  const safe = source || fallback;
  return safe.includes('.') || !extensionForMimeType(mimeType)
    ? safe
    : `${safe}${extensionForMimeType(mimeType)}`;
};

const assertSafePathSegment = (value: string, label: string) => {
  if (!SAFE_PATH_SEGMENT.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
};

export const createLocalProjectAssetObjectKey = ({
  projectId,
  assetId,
  filename,
}: {
  projectId: string;
  assetId: string;
  filename: string;
}) => {
  assertSafePathSegment(projectId, 'project id');
  assertSafePathSegment(assetId, 'asset id');
  return `${projectId}/${assetId}/${filename}`;
};

export const resolveLocalProjectAssetPath = ({
  objectKey,
  assetRoot = getLocalProjectAssetRoot(),
}: {
  objectKey: string;
  assetRoot?: string;
}) => {
  const normalizedRoot = resolve(assetRoot);
  const filePath = resolve(normalizedRoot, objectKey);
  const relativePath = relative(normalizedRoot, filePath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Invalid local project asset path');
  }
  let currentPath = normalizedRoot;
  for (const segment of relativePath.split(sep)) {
    currentPath = resolve(currentPath, segment);
    try {
      if (lstatSync(currentPath).isSymbolicLink()) {
        throw new Error('Symbolic links are not allowed in local project asset paths');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
  }
  return filePath;
};

export const buildLocalProjectAssetUrl = ({
  projectId,
  assetId,
}: {
  projectId: string;
  assetId: string;
}) =>
  `/api/app/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;

export const persistLocalProjectAsset = async ({
  projectId,
  assetId = randomUUID(),
  filename,
  mimeType,
  bytes,
  assetRoot = getLocalProjectAssetRoot(),
}: {
  projectId: string;
  assetId?: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  assetRoot?: string;
}) => {
  const safeFilename = sanitizeLocalProjectAssetFilename({ filename, mimeType });
  const objectKey = createLocalProjectAssetObjectKey({
    projectId,
    assetId,
    filename: safeFilename,
  });
  const filePath = resolveLocalProjectAssetPath({ objectKey, assetRoot });
  const tempPath = `${filePath}.tmp-${randomUUID()}`;

  await mkdir(dirname(filePath), { recursive: true });
  // Re-check after creating the directory tree so a pre-existing symlink cannot
  // redirect writes outside the project-owned asset root.
  resolveLocalProjectAssetPath({ objectKey, assetRoot });
  try {
    await writeFile(tempPath, bytes, { flag: 'wx' });
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return {
    assetId,
    filename: safeFilename,
    objectKey,
    filePath,
    publicUrl: buildLocalProjectAssetUrl({ projectId, assetId }),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.byteLength,
  };
};

export const removePersistedLocalProjectAsset = async (filePath: string) => {
  await unlink(filePath).catch(() => undefined);
};
