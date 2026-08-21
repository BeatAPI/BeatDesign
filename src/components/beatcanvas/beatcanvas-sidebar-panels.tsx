'use client';

import {
  type RecentAsset,
  fetchRecentAssets,
} from '@/core/workspace-lib/app/workspace-client-api';
import { recentAssetsKeys } from '@/core/workspace-lib/app/workspace-query-keys';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { beatPanelLabelClassName } from '@/components/app/composer-styles';
import { cn } from '@/lib/utils';

export function HistoryPanel({
  onSelectAsset,
  projectId,
}: {
  onSelectAsset: (
    asset: RecentAsset & { mediaType: 'image' | 'video' }
  ) => void;
  projectId?: string | null;
}) {
  const t = useTranslations('AppShell.studio');
  const { data, isLoading, isError } = useQuery({
    queryKey: recentAssetsKeys.lists(projectId),
    queryFn: () => fetchRecentAssets(projectId),
    staleTime: 60 * 1000,
  });

  const images = data?.images ?? [];
  const videos = data?.videos ?? [];
  const loading = isLoading;
  const error = isError ? t('sidebar.loadFailed') : null;

  const hasContent = images.length > 0 || videos.length > 0;

  return (
    <div className="flex flex-col p-2">
      <div className={cn(beatPanelLabelClassName, 'mb-2 px-2 pt-1')}>
        {t('sidebar.recentAssetsTitle')}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-2 py-6 text-[12px] text-[var(--beat-text-3)]">
          <Loader2 size={14} className="animate-spin" />
          {t('sidebar.loading')}
        </div>
      ) : null}

      {error ? (
        <div className="px-2 py-3 text-[12px] text-[var(--beatcanvas-error)]">{error}</div>
      ) : null}

      {!loading && !error && !hasContent ? (
        <div className="px-2 py-3 text-[12px] text-[var(--beat-text-3)]">
          {t('sidebar.emptyAssets')}
        </div>
      ) : null}

      {!loading && images.length > 0 ? (
        <AssetSection label={t('sidebar.recentImages')}>
          {images.map((img) => (
            <AssetThumbnail
              key={img.id}
              src={img.publicUrl}
              alt={t('sidebar.recentImageAlt')}
              onClick={() => onSelectAsset({ ...img, mediaType: 'image' })}
            />
          ))}
        </AssetSection>
      ) : null}

      {!loading && videos.length > 0 ? (
        <AssetSection label={t('sidebar.recentVideos')}>
          {videos.map((vid) => (
            <AssetThumbnail
              key={vid.id}
              src={vid.publicUrl}
              alt={t('sidebar.recentVideoAlt')}
              isVideo
              onClick={() => onSelectAsset({ ...vid, mediaType: 'video' })}
            />
          ))}
        </AssetSection>
      ) : null}
    </div>
  );
}

function AssetSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-2">
      <div className={cn(beatPanelLabelClassName, 'mb-1.5 px-2')}>{label}</div>
      <div className="grid grid-cols-3 gap-1.5 px-1">{children}</div>
    </div>
  );
}

function AssetThumbnail({
  src,
  alt,
  isVideo = false,
  onClick,
}: {
  src: string;
  alt: string;
  isVideo?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] transition-all duration-200 hover:scale-[1.04] hover:border-[var(--beat-graph)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.35)] active:scale-[0.98]"
    >
      {isVideo ? (
        <video
          src={src}
          aria-label={alt}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          draggable={false}
        />
      )}
      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
            <Video size={12} className="text-[#1D1D1F]" />
          </div>
        </div>
      ) : null}
    </button>
  );
}
