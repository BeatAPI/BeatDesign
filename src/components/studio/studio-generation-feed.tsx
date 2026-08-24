'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { composerCardClassName } from '@/components/app/composer-styles';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProjectGenerationItem } from '@/core/effects/project-generations';
import { formatStudioHistoryDateTime } from '@/core/studio/studio-history';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { cn } from '@/lib/utils';

const chipClassName =
  'inline-flex h-6 items-center rounded-full border border-white/[0.09] bg-white/[0.035] px-2 text-[11px] font-medium text-[var(--beat-text-1)]';

function StudioHistoryItem({
  item,
  onOpen,
  onReuse,
}: {
  item: ProjectGenerationItem;
  onOpen: () => void;
  onReuse: () => void;
}) {
  const t = useTranslations('AppShell.studio.feed');
  const isBusy = item.status === 'pending' || item.status === 'processing';
  const isAnalysis = item.mediaType === 'analysis';
  const isVideo = item.mediaType === 'video';
  const previewUrl = item.resultUrl;

  return (
    <article className="space-y-3">
      <button
        type="button"
        onClick={onReuse}
        className="flex flex-wrap items-center gap-2 text-left"
      >
        <span className={chipClassName}>
          {isAnalysis ? t('analysis') : isVideo ? t('video') : t('image')}
        </span>
        <span className={chipClassName}>
          {item.modelName || item.modelId || t('result')}
        </span>
        <span className="text-[12px] text-[var(--beat-text-3)]">
          {formatStudioHistoryDateTime(new Date(item.createdAt))}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('openPreview')}
        className="block text-left"
      >
        <div className="h-[240px] w-[min(100%,400px)] overflow-hidden rounded-[16px] bg-black/20">
          {isAnalysis && item.resultText ? (
            <div className="h-full overflow-hidden p-5">
              <p className="line-clamp-[8] whitespace-pre-wrap break-words text-[13px] leading-6 text-[var(--beat-text-2)]">
                {item.resultText}
              </p>
            </div>
          ) : previewUrl ? (
            isVideo ? (
              <video
                src={previewUrl}
                preload="metadata"
                muted
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={previewUrl}
                alt=""
                className="block h-full w-full object-contain"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-[var(--beat-text-3)]">
              {isBusy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                t('noPrompt')
              )}
            </div>
          )}
        </div>
      </button>
    </article>
  );
}

export function StudioGenerationFeed({
  items,
  onReuse,
}: {
  items: ProjectGenerationItem[];
  onReuse: (item: ProjectGenerationItem) => void;
}) {
  const t = useTranslations('AppShell.studio.feed');
  const endRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [
    items.length,
    items.at(-1)?.status,
    items.at(-1)?.resultUrl,
    items.at(-1)?.resultText,
  ]);

  return (
    <>
      <section className="mx-auto flex w-full max-w-[1138px] flex-col gap-5 pb-4">
        {items.map((item) => (
          <StudioHistoryItem
            key={item.id}
            item={item}
            onOpen={() => setSelectedId(item.id)}
            onReuse={() => onReuse(item)}
          />
        ))}
        <div ref={endRef} />
      </section>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        {selected ? (
          <DialogContent
            showCloseButton={false}
            className={cn(
              'h-[min(900px,calc(100vh-2.25rem))] w-[min(1680px,calc(100vw-2.25rem))] max-w-none overflow-hidden p-0 text-[var(--beat-text-1)] sm:max-w-none',
              composerCardClassName
            )}
          >
            <DialogTitle className="sr-only">
              {selected.modelName || t('result')}
            </DialogTitle>
            <DialogClose className="absolute right-2 top-2 z-30 inline-flex size-10 items-center justify-center rounded-full border border-white/[0.09] bg-black/45 text-white/88 backdrop-blur-xl">
              <X className="size-5" />
              <span className="sr-only">{t('closePreview')}</span>
            </DialogClose>
            <div className="grid h-full min-h-0 xl:grid-cols-[minmax(0,1.12fr)_420px]">
              <div className="relative flex items-center justify-center overflow-hidden bg-black/40 px-6 py-6">
                {selected.mediaType === 'analysis' ? (
                  <div className="h-full w-full overflow-y-auto rounded-[var(--beat-radius-sm)] border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
                    <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-[var(--beat-text-3)]">
                      {t('analysisResult')}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-[var(--beat-text-1)] sm:text-[15px]">
                      {selected.resultText || (selected.status === 'processing' ? t('generating') : t('failed'))}
                    </p>
                  </div>
                ) : selected.mediaType === 'video' && selected.resultUrl ? (
                  <video
                    src={selected.resultUrl}
                    controls
                    className="max-h-full max-w-full rounded-[var(--beat-radius-sm)] bg-black object-contain"
                  />
                ) : selected.resultUrl ? (
                  <img
                    src={selected.resultUrl}
                    alt={selected.prompt || selected.modelName || t('result')}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="flex min-h-0 flex-col border-t border-white/[0.08] xl:border-l xl:border-t-0">
                <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.08] px-6 py-5">
                  <span className={chipClassName}>
                    {selected.mediaType === 'analysis'
                      ? t('analysis')
                      : selected.mediaType === 'video'
                        ? t('video')
                        : t('image')}
                  </span>
                  <span className={chipClassName}>
                    {selected.modelName || selected.modelId || t('result')}
                  </span>
                  {selected.paramsLabel ? (
                    <span
                      className={cn(chipClassName, 'text-[var(--beat-text-2)]')}
                    >
                      {selected.paramsLabel}
                    </span>
                  ) : null}
                </div>
                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                  <div className="flex h-[min(260px,34vh)] min-h-[180px] flex-col rounded-[var(--beat-radius-sm)] border border-white/[0.09] bg-white/[0.03] p-4">
                    <p className="shrink-0 text-[13px] text-[var(--beat-text-3)]">
                      {t('prompt')}
                    </p>
                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-[var(--beat-text-2)]">
                        {selected.prompt || t('noPrompt')}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[var(--beat-radius-sm)] border border-white/[0.09] bg-white/[0.03] px-4 py-1">
                    <div className="flex items-start justify-between gap-6 border-b border-white/[0.08] py-3">
                      <span className="text-sm text-[var(--beat-text-3)]">
                        {t('model')}
                      </span>
                      <span className="text-right text-sm text-[var(--beat-text-1)]">
                        {selected.modelName || selected.modelId || t('result')}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-6 py-3">
                      <span className="text-sm text-[var(--beat-text-3)]">
                        {t('params')}
                      </span>
                      <span className="text-right text-sm text-[var(--beat-text-1)]">
                        {selected.paramsLabel || '—'}
                      </span>
                    </div>
                  </div>
                  {selected.referenceImages.length > 0 ||
                  selected.referenceVideos.length > 0 ? (
                    <div className="rounded-[var(--beat-radius-sm)] border border-white/[0.09] bg-white/[0.03] p-4">
                      <p className="text-[13px] text-[var(--beat-text-3)]">
                        {t('references')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selected.referenceImages.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block size-16 overflow-hidden rounded-[10px] bg-black/30"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                        {selected.referenceVideos.map((url) => (
                          <video
                            key={url}
                            src={url}
                            muted
                            playsInline
                            preload="metadata"
                            className="size-16 rounded-[10px] bg-black/30 object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
