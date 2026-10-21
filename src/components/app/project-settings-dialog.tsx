import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings2, Upload } from 'lucide-react';
import { ProjectCoverPreview } from './project-cover-preview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useTranslations,
  useLocale,
} from '@/core/workspace-lib/shims/next-intl';
import {
  fetchProjectSettings,
  saveProjectSettings,
} from '@/core/workspace-lib/app/project-settings-client';
import { uploadLocalProjectAsset } from '@/core/workspace-lib/app/local-project-asset-client';
import {
  fetchRecentAssets,
  type RecentAsset,
} from '@/core/workspace-lib/app/workspace-client-api';
import {
  invalidateWorkspaceAfterProjectMutation,
  invalidateWorkspaceAfterAssetMutation,
} from '@/core/workspace-lib/app/workspace-query-invalidation';
import type { ProjectSettings } from '@/core/projects/project-settings-contract';
import { ApiError } from '@/lib/api-client';

export function ProjectSettingsDialog({
  projectId,
  onSaved,
}: {
  projectId: string;
  onSaved?: (settings: ProjectSettings) => void;
}) {
  const t = useTranslations('ProjectSettings');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverId, setCoverId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [autoCover, setAutoCover] = useState(true);
  const [images, setImages] = useState<RecentAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!open) return;
    const request = ++generation.current;
    setLoaded(false);
    setSettings(null);
    setError('');
    void Promise.all([
      fetchProjectSettings(projectId),
      fetchRecentAssets(projectId),
    ])
      .then(([value, assets]) => {
        if (request !== generation.current) return;
        setSettings(value);
        setName(value.name);
        setDescription(value.description);
        setCoverId(value.coverAssetId);
        setCoverUrl(value.coverImageUrl);
        setAutoCover(value.coverMode === 'auto');
        setImages(assets.images);
        setLoaded(true);
      })
      .catch((err) => {
        if (request === generation.current)
          setError(err instanceof Error ? err.message : t('loadError'));
      });
    return () => {
      generation.current++;
    };
  }, [open, projectId, locale]);

  async function upload(file?: File) {
    if (!file || busy) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
        file.type,
      )
    ) {
      setError(t('imageOnly'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const asset = await uploadLocalProjectAsset({ projectId, file });
      setCoverId(asset.id);
      setCoverUrl(asset.publicUrl);
      setAutoCover(false);
      setImages((old) => [
        {
          ...asset,
          width: asset.width ?? null,
          height: asset.height ?? null,
          createdAt: new Date().toISOString(),
        },
        ...old,
      ]);
      await invalidateWorkspaceAfterAssetMutation(queryClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function save() {
    if (!settings || busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const next = await saveProjectSettings(
        projectId,
        settings.settingsRevision,
        {
          name,
          description,
          cover: autoCover
            ? { mode: 'auto' }
            : { mode: 'manual', assetId: coverId! },
        },
      );
      await invalidateWorkspaceAfterProjectMutation(queryClient);
      onSaved?.(next);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 409
          ? t('conflict')
          : err instanceof Error
            ? err.message
            : t('saveError'),
      );
    } finally {
      setBusy(false);
    }
  }

  const control =
    'w-full rounded-lg border border-white/10 bg-[#202126] px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b1a]';
  const button =
    'rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#ff6b1a] disabled:opacity-40';
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogTrigger
        disabled={!interactive}
        aria-label={t('title')}
        title={t('title')}
        className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#ff6b1a]"
      >
        <Settings2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#111214] text-[#f6f6f4] sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-white/50">
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
          >
            {error}{' '}
            <button
              type="button"
              className="underline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('closeReload')}
            </button>
          </div>
        )}
        {!loaded ? (
          <p className="py-8 text-sm text-white/50">{t('loading')}</p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="space-y-6"
          >
            <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
              <h3 className="border-b border-white/10 pb-3 text-sm font-semibold">
                {t('details')}
              </h3>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
                <label
                  htmlFor={`project-name-${projectId}`}
                  className="text-sm font-medium"
                >
                  {t('name')}
                </label>
                <input
                  id={`project-name-${projectId}`}
                  className={control}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={240}
                  required
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
                <label
                  htmlFor={`project-description-${projectId}`}
                  className="text-sm font-medium"
                >
                  {t('description')}
                  <span className="mt-1 block text-xs font-normal text-white/40">
                    {t('descriptionHint')}
                  </span>
                </label>
                <div>
                  <textarea
                    id={`project-description-${projectId}`}
                    className={`${control} min-h-24 resize-y`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={140}
                    placeholder={t('descriptionPlaceholder')}
                  />
                  <p className="mt-1 text-right text-xs text-white/40">
                    {description.length}/140
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:gap-6">
                <div className="text-sm font-medium">
                  {t('cover')}
                  <p className="mt-1 text-xs font-normal leading-5 text-white/40">
                    {t('coverHint')}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#202126]">
                    <ProjectCoverPreview url={coverUrl} alt={t('cover')} />
                  </div>
                  <p className="text-xs text-white/50">
                    {autoCover ? t('automatic') : t('manual')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload className="mr-1 inline size-3.5" />
                      {t('upload')}
                    </button>
                    <button
                      type="button"
                      className={button}
                      onClick={() => {
                        setAutoCover(true);
                        setCoverUrl(settings?.automaticCoverImageUrl ?? null);
                      }}
                    >
                      {t('reset')}
                    </button>
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    aria-label={t('upload')}
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  {images.length > 0 && (
                    <>
                      <p className="text-xs text-white/50">{t('choose')}</p>
                      <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto p-1">
                        {images.map((image) => (
                          <button
                            type="button"
                            key={image.id}
                            aria-label={image.filename || image.id}
                            aria-pressed={!autoCover && coverId === image.id}
                            onClick={() => {
                              setCoverId(image.id);
                              setCoverUrl(image.publicUrl);
                              setAutoCover(false);
                            }}
                            className={`aspect-video overflow-hidden rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-[#ff6b1a] ${!autoCover && coverId === image.id ? 'border-[#ff6b1a]' : 'border-transparent'}`}
                          >
                            <img
                              src={image.publicUrl}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <h3 className="border-b border-white/10 pb-3 text-sm font-semibold">
                {t('info')}
              </h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr] sm:gap-x-6 sm:gap-y-4">
                <dt className="text-white/50">{t('id')}</dt>
                <dd className="break-all font-mono text-xs text-white/70">
                  {settings?.id}
                </dd>
                <dt className="text-white/50">{t('created')}</dt>
                <dd>
                  {settings &&
                    new Date(settings.createdAt).toLocaleDateString()}
                </dd>
                <dt className="text-white/50">{t('storage')}</dt>
                <dd>{t('local')}</dd>
              </dl>
            </fieldset>
            <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={busy}
                className={button}
                onClick={() => setOpen(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={busy || !name.trim() || (!autoCover && !coverId)}
                className="rounded-lg bg-[#ff6b1a] px-5 py-2 text-sm font-semibold text-black hover:bg-[#ff8a4d] disabled:opacity-40"
              >
                {busy ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
