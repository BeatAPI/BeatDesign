'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AudioLines,
  ExternalLink,
  FolderOpen,
  Images,
  Loader2,
  MousePointer2,
  Plus,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  fetchRecentAssets,
  type RecentAsset,
} from '@/core/workspace-lib/app/workspace-client-api';
import { recentAssetsKeys } from '@/core/workspace-lib/app/workspace-query-keys';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { beatPanelLabelClassName } from '@/components/app/composer-styles';
import {
  PROJECT_ASSET_DRAG_MIME,
  PROJECT_ASSET_INSERT_EVENT,
  type ProjectAssetInsertDetail,
  type ProjectAssetTransfer,
} from '@/core/beatcanvas/project-asset-transfer';
import { addProjectAssetToTimeline } from '@/core/editor/timeline-client';

const assetOperation = (asset: RecentAsset) => {
  if (!asset.metadata || typeof asset.metadata !== 'object') return '';
  const operation = (asset.metadata as { operation?: unknown }).operation;
  return typeof operation === 'string' ? operation : '';
};

function AssetTile({
  asset,
  mediaType,
  projectId,
  canAddToCanvas,
  onAdded,
  addLabel,
  addTimelineLabel,
  badgeLabel,
  openLabel,
}: {
  asset: RecentAsset;
  mediaType: 'image' | 'video' | 'audio';
  projectId: string;
  canAddToCanvas: boolean;
  onAdded: () => void;
  addLabel: string;
  addTimelineLabel: string;
  badgeLabel: string | null;
  openLabel: string;
}) {
  const [isAddingToTimeline, setIsAddingToTimeline] = useState(false);
  const transfer: ProjectAssetTransfer = {
    ...asset,
    projectId,
    mediaType,
  };

  const addToCanvas = () => {
    if (!canAddToCanvas) return;
    window.dispatchEvent(
      new CustomEvent<ProjectAssetInsertDetail>(PROJECT_ASSET_INSERT_EVENT, {
        detail: { asset: transfer },
      })
    );
    onAdded();
  };

  return (
    <div
      draggable={canAddToCanvas}
      onDragStart={(event) => {
        if (!canAddToCanvas) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(
          PROJECT_ASSET_DRAG_MIME,
          JSON.stringify(transfer)
        );
      }}
      onDragEnd={(event) => {
        if (event.dataTransfer.dropEffect === 'copy') onAdded();
      }}
      className={`group relative overflow-hidden rounded-[14px] bg-white/[0.025] transition hover:-translate-y-0.5 ${
        mediaType === 'audio' ? 'h-[112px] w-[360px]' : 'h-[200px] w-fit'
      } ${
        canAddToCanvas ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      title={asset.filename || addLabel}
    >
      {mediaType === 'audio' ? (
        <div className="flex size-full flex-col justify-between border border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-2">
            <AudioLines className="size-4 text-[var(--beat-graph)]" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-white/80">
              {asset.filename || asset.id}
            </p>
          </div>
          <audio
            src={asset.publicUrl}
            controls
            preload="metadata"
            className="h-8 w-full opacity-75"
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
      ) : mediaType === 'video' ? (
        <video
          src={asset.publicUrl}
          muted
          playsInline
          preload="metadata"
          className="h-full w-auto object-contain"
        />
      ) : (
        <img
          src={asset.publicUrl}
          alt={asset.filename || ''}
          className="h-full w-auto object-contain"
        />
      )}
      {mediaType === 'video' ? (
        <span className="pointer-events-none absolute bottom-2 left-2 grid size-7 place-items-center rounded-full border border-white/15 bg-black/65 text-white backdrop-blur">
          <Video className="size-3.5" />
        </span>
      ) : null}
      {badgeLabel ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded-md border border-[#ff7a33]/25 bg-black/65 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#ffad7e] backdrop-blur">
          {badgeLabel}
        </span>
      ) : null}

      {canAddToCanvas || mediaType === 'image' || mediaType === 'video' || mediaType === 'audio' ? (
        <div className="absolute inset-0 flex items-end justify-center gap-1.5 bg-gradient-to-t from-black/85 via-black/10 to-transparent px-2 pb-2 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {canAddToCanvas ? (
            <button
              type="button"
              onClick={addToCanvas}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-white/12 px-2.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur-md"
              aria-label={`${addLabel}: ${asset.filename || asset.id}`}
            >
              <Plus className="size-3" />
              {addLabel}
            </button>
          ) : null}
          {mediaType === 'image' || mediaType === 'video' || mediaType === 'audio' ? (
            <button
              type="button"
              disabled={isAddingToTimeline}
              onClick={() => {
                if (isAddingToTimeline) return;
                setIsAddingToTimeline(true);
                void addProjectAssetToTimeline({ projectId, asset, mediaType })
                  .then(() => toast.success(addTimelineLabel))
                  .catch((error: Error) => toast.error(error.message))
                  .finally(() => setIsAddingToTimeline(false));
              }}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-white/12 px-2.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur-md disabled:cursor-wait disabled:opacity-55"
              aria-label={`${addTimelineLabel}: ${asset.filename || asset.id}`}
            >
              {isAddingToTimeline ? (
                <Loader2 className="size-3 animate-spin" />
              ) : mediaType === 'image' ? (
                  <Images className="size-3" />
                ) : (
                  <Video className="size-3" />
              )}
              {addTimelineLabel}
            </button>
          ) : null}
        </div>
      ) : mediaType === 'image' ? (
        <a
          href={asset.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-0"
          aria-label={`${openLabel}: ${asset.filename || asset.id}`}
        />
      ) : null}

      {canAddToCanvas ? (
        <a
          href={asset.publicUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full border border-white/15 bg-black/65 text-white/75 opacity-0 backdrop-blur transition hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label={`${openLabel}: ${asset.filename || asset.id}`}
          title={openLabel}
        >
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

export function ProjectAssetsLibrary({
  projectId,
  canAddToCanvas = false,
  onAdded,
}: {
  projectId: string;
  canAddToCanvas?: boolean;
  onAdded?: () => void;
}) {
  const t = useTranslations('AppShell.header.projectAssets');
  const assetsQuery = useQuery({
    queryKey: recentAssetsKeys.lists(projectId),
    queryFn: () => fetchRecentAssets(projectId),
    staleTime: 30 * 1000,
  });
  const images = assetsQuery.data?.images ?? [];
  const videos = assetsQuery.data?.videos ?? [];
  const audios = assetsQuery.data?.audios ?? [];
  const total = images.length + videos.length + audios.length;
  const badgeFor = (asset: RecentAsset) => {
    const operation = assetOperation(asset);
    if (operation === 'video_tail_frame') return t('tailFrame');
    if (operation === 'timeline_render') return t('timelineRender');
    if (operation === 'timeline_extract') return t('timelineExtract');
    if (asset.assetClass === 'derived') return t('derivedClip');
    return null;
  };

  return (
    <>
      {assetsQuery.isLoading ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-[13px] text-white/45">
          <Loader2 className="size-4 animate-spin" />
          {t('loading')}
        </div>
      ) : null}

      {assetsQuery.isError ? (
        <div className="flex min-h-52 items-center justify-center text-[13px] text-[#ff8a8d]">
          {t('loadFailed')}
        </div>
      ) : null}

      {!assetsQuery.isLoading && !assetsQuery.isError && total === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center text-center">
          <span className="grid size-12 place-items-center rounded-[15px] border border-white/[0.08] bg-white/[0.035] text-white/28">
            <Images className="size-5" />
          </span>
          <p className="mt-4 text-[14px] font-medium text-white/72">
            {t('empty')}
          </p>
        </div>
      ) : null}

      {!assetsQuery.isLoading && !assetsQuery.isError && total > 0 ? (
        <div className="space-y-6">
          {images.length > 0 ? (
            <section>
              <h3 className={`mb-3 ${beatPanelLabelClassName}`}>
                {t('images')}
              </h3>
              <div className="flex flex-wrap gap-3">
                {images.map((asset) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    mediaType="image"
                    projectId={projectId}
                    canAddToCanvas={canAddToCanvas}
                    onAdded={() => onAdded?.()}
                    addLabel={t('addToCanvas')}
                    addTimelineLabel={t('addToTimeline')}
                    badgeLabel={badgeFor(asset)}
                    openLabel={t('openOriginal')}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {videos.length > 0 ? (
            <section>
              <h3 className={`mb-3 ${beatPanelLabelClassName}`}>
                {t('videos')}
              </h3>
              <div className="flex flex-wrap gap-3">
                {videos.map((asset) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    mediaType="video"
                    projectId={projectId}
                    canAddToCanvas={canAddToCanvas}
                    onAdded={() => onAdded?.()}
                    addLabel={t('addToCanvas')}
                    addTimelineLabel={t('addToTimeline')}
                    badgeLabel={badgeFor(asset)}
                    openLabel={t('openOriginal')}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {audios.length > 0 ? (
            <section>
              <h3 className={`mb-3 ${beatPanelLabelClassName}`}>
                {t('audios')}
              </h3>
              <div className="flex flex-wrap gap-3">
                {audios.map((asset) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    mediaType="audio"
                    projectId={projectId}
                    canAddToCanvas={canAddToCanvas}
                    onAdded={() => onAdded?.()}
                    addLabel={t('addToCanvas')}
                    addTimelineLabel={t('addToTimeline')}
                    badgeLabel={badgeFor(asset)}
                    openLabel={t('openOriginal')}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function ProjectAssetsDialog({
  projectId,
  canAddToCanvas = false,
}: {
  projectId: string;
  canAddToCanvas?: boolean;
}) {
  const t = useTranslations('AppShell.header.projectAssets');
  const [open, setOpen] = useState(false);

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={t('triggerLabel')}
        title={t('triggerLabel')}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-2.5 text-[#a0a1a8] transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a33]/45 sm:px-3"
      >
        <Images className="size-[16px]" />
        <span className="hidden text-xs font-medium sm:inline">
          {t('triggerLabel')}
        </span>
      </DialogTrigger>

      <DialogContent
        showOverlay={false}
        className="max-h-[82vh] overflow-hidden rounded-[28px] border border-white/10 bg-[#111214] p-0 text-[#f5f5f7] shadow-[0_34px_110px_rgba(0,0,0,0.62)] ring-0 sm:max-w-[760px] [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:text-white/45 [&_[data-slot=dialog-close]]:hover:bg-white/[0.07] [&_[data-slot=dialog-close]]:hover:text-white"
      >
        <DialogHeader className="border-b border-white/[0.08] px-6 pb-5 pt-6 text-left">
          <span className="mb-2 grid size-10 place-items-center rounded-[13px] border border-[#ff7a33]/25 bg-[#ff7a33]/10 text-[#ff8b4d]">
            <FolderOpen className="size-[18px]" />
          </span>
          <DialogTitle className="text-[21px] font-semibold tracking-[-0.03em] text-white">
            {t('title')}
          </DialogTitle>
          <DialogDescription className="max-w-xl text-[13px] leading-5 text-white/48">
            {t('description')}
          </DialogDescription>
          {canAddToCanvas ? (
            <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-[#ff7a33]/18 bg-[#ff7a33]/[0.07] px-3 py-1.5 text-[11px] font-medium text-[#ffad7e]">
              <MousePointer2 className="size-3.5" />
              {t('canvasHint')}
            </div>
          ) : null}
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-5 sm:px-6">
          <ProjectAssetsLibrary
            projectId={projectId}
            canAddToCanvas={canAddToCanvas}
            onAdded={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
