'use client';

import {
  type RecentAsset,
  fetchRecentAssets,
} from '@/core/workspace-lib/app/workspace-client-api';
import { recentAssetsKeys } from '@/core/workspace-lib/app/workspace-query-keys';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  ImagePlus,
  Loader2,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { beatPanelLabelClassName } from '@/components/app/composer-styles';
import { cn } from '@/lib/utils';

export function UploadNodePanel({
  isUploadDisabled,
  onUploadImage,
  onUploadVideo,
  onClose,
}: {
  isUploadDisabled: boolean;
  onUploadImage: () => void;
  onUploadVideo: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('AppShell.studio');
  const handleAction = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div className="flex flex-col gap-0.5 p-2">
      <div className={cn(beatPanelLabelClassName, 'px-2 pb-1.5 pt-1')}>
        {t('sidebar.uploadNodeTitle')}
      </div>

      <PanelButton
        icon={<ImagePlus className="size-3.5" />}
        label={t('actions.uploadImage')}
        onClick={() => handleAction(onUploadImage)}
        disabled={isUploadDisabled}
      />
      <PanelButton
        icon={<Video className="size-3.5" />}
        label={t('actions.uploadVideo')}
        onClick={() => handleAction(onUploadVideo)}
        disabled={isUploadDisabled}
      />
    </div>
  );
}

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

function PanelButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="grid size-6 shrink-0 place-items-center text-[var(--beat-text-2)] transition-colors group-hover:text-[var(--beat-text-1)]">
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-medium text-[var(--beat-text-1)]">
        {label}
      </span>
      <ChevronRight
        size={14}
        className="text-white/25 transition-colors group-hover:text-white/45"
      />
    </button>
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
