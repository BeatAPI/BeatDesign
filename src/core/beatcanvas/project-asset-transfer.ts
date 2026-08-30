import type { RecentAsset } from '@/core/workspace-lib/app/workspace-client-api';

export const PROJECT_ASSET_DRAG_MIME =
  'application/x-beatapi-project-asset+json';
export const PROJECT_ASSET_INSERT_EVENT = 'beatapi:project-asset-insert';

export type ProjectAssetTransfer = RecentAsset & {
  mediaType: 'image' | 'video' | 'audio';
  projectId: string;
};

export type ProjectAssetInsertDetail = {
  asset: ProjectAssetTransfer;
  clientPoint?: { x: number; y: number };
};

const isFiniteNullableNumber = (value: unknown) =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

export function parseProjectAssetTransfer(
  value: string
): ProjectAssetTransfer | null {
  try {
    const parsed = JSON.parse(value) as Partial<ProjectAssetTransfer>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.projectId !== 'string' ||
      typeof parsed.publicUrl !== 'string' ||
      (parsed.mediaType !== 'image' &&
        parsed.mediaType !== 'video' &&
        parsed.mediaType !== 'audio') ||
      !isFiniteNullableNumber(parsed.width) ||
      !isFiniteNullableNumber(parsed.height)
    ) {
      return null;
    }

    return {
      id: parsed.id,
      projectId: parsed.projectId,
      publicUrl: parsed.publicUrl,
      mediaType: parsed.mediaType,
      filename:
        typeof parsed.filename === 'string' || parsed.filename === null
          ? parsed.filename
          : null,
      width: parsed.width ?? null,
      height: parsed.height ?? null,
      durationMs:
        typeof parsed.durationMs === 'number' || parsed.durationMs === null
          ? parsed.durationMs
          : null,
      createdAt:
        typeof parsed.createdAt === 'string' || parsed.createdAt instanceof Date
          ? parsed.createdAt
          : new Date(0).toISOString(),
      mimeType:
        typeof parsed.mimeType === 'string' || parsed.mimeType === null
          ? parsed.mimeType
          : null,
      assetClass:
        typeof parsed.assetClass === 'string' || parsed.assetClass === null
          ? parsed.assetClass
          : null,
      metadata: parsed.metadata,
    };
  } catch {
    return null;
  }
}

export function isProjectAssetTransferType(types: readonly string[]): boolean {
  return types.includes(PROJECT_ASSET_DRAG_MIME);
}

export function getProjectAssetCardSize(asset: RecentAsset): {
  w: number;
  h: number;
} {
  if (asset.mimeType?.startsWith('audio/')) {
    return { w: 320, h: 104 };
  }
  if (
    asset.width &&
    asset.height &&
    asset.width > 0 &&
    asset.height > 0
  ) {
    const maxEdge = 360;
    const ratio = asset.width / asset.height;
    return ratio >= 1
      ? { w: maxEdge, h: Math.round(maxEdge / ratio) }
      : { w: Math.round(maxEdge * ratio), h: maxEdge };
  }

  return { w: 320, h: 320 };
}
