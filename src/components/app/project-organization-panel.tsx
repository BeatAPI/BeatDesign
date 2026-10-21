import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  previewFolderRemoval,
  type OrganizationOperation,
  type ProjectOrganizationDocument,
  type AssetFolder,
} from '@/core/organization/organization-document';

export type OrganizationPanelAsset = {
  id: string;
  type: string;
  filename?: string | null;
  publicUrl?: string | null;
};
export type OrganizationAssetQuery = {
  folderId: string | null;
  scope: 'current' | 'project';
  query: string;
  cursor?: string;
};
export type ProjectOrganizationPanelProps = {
  document: ProjectOrganizationDocument;
  revision: number;
  assets: OrganizationPanelAsset[];
  onApply: (
    operations: OrganizationOperation[],
    expectedRevision?: number
  ) => Promise<unknown> | unknown;
  onQuery?: (query: OrganizationAssetQuery) => Promise<{
    assets: OrganizationPanelAsset[];
    nextCursor?: string | null;
  } | void>;
  onLocate?: (assetId: string) => void;
  consumers?: Array<{
    elementId: string;
    consumerCardId: string;
    name: string;
  }>;
  onLocateConsumer?: (cardId: string) => void;
};

const control =
  'min-h-11 rounded-lg border border-white/15 bg-[var(--beat-surface,#17181b)] px-3 text-sm text-[var(--beat-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-40';
const button = `${control} hover:bg-white/10`;

/** Project-local organization controls; all writes are delegated to the shared kernel owner. */
export function ProjectOrganizationPanel({
  document,
  revision,
  assets,
  onApply,
  onQuery,
  onLocate,
  consumers,
  onLocateConsumer,
}: ProjectOrganizationPanelProps) {
  const t = useTranslations('Organization');
  const [tab, setTab] = useState<'folders' | 'elements'>('folders');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [scope, setScope] = useState<'current' | 'project'>('project');
  const [query, setQuery] = useState('');
  const [queried, setQueried] = useState<OrganizationPanelAsset[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [folderName, setFolderName] = useState('');
  const [destination, setDestination] = useState('');
  const [preview, setPreview] = useState<ReturnType<
    typeof previewFolderRemoval
  > | null>(null);
  const [elementId, setElementId] = useState('');
  const [elementName, setElementName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'character' | 'scene' | 'prop' | 'voice'>(
    'character'
  );
  const [assetId, setAssetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryGeneration = useRef(0);
  const folders = Object.values(document.folders).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const activeElements = Object.values(document.elements).filter(
    (element) => !element.deletedAt
  );
  const deletedElements = Object.values(document.elements).filter(
    (element) => element.deletedAt
  );
  const currentElement = elementId ? document.elements[elementId] : undefined;
  const stale = editRevision !== null && editRevision !== revision;
  const markEdit = () => setEditRevision((current) => current ?? revision);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setQueried(null);
    setCursor(null);
  }, [assets]);
  useEffect(() => {
    if (editRevision !== null) return;
    if (folderId && !document.folders[folderId]) {
      setFolderId(null);
      setScope('current');
      setQueried(null);
      setCursor(null);
    }
    if (
      elementId &&
      (!document.elements[elementId] || document.elements[elementId].deletedAt)
    ) {
      setElementId('');
      setElementName('');
      setDescription('');
      setAssetId('');
    }
  }, [document, folderId, elementId, editRevision]);
  function folderPath(id: string): string {
    const parts: string[] = [];
    const seen = new Set<string>();
    let current: string | null = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      const folder: AssetFolder | undefined = document.folders[current];
      if (!folder) break;
      parts.unshift(folder.name);
      current = folder.parentId;
    }
    return parts.join(' / ');
  }
  async function apply(operations: OrganizationOperation[]) {
    if (busy) return;
    if (stale) {
      setError(t('conflict'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onApply(operations, editRevision ?? revision);
      setEditRevision(null);
      setPreview(null);
      setSelected([]);
      setQueried(null);
      setCursor(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }
  async function search(next: OrganizationAssetQuery, append = false) {
    if (!onQuery) return;
    const generation = ++queryGeneration.current;
    setBusy(true);
    setError('');
    try {
      const result = await onQuery(next);
      if (generation !== queryGeneration.current || !result) return;
      setQueried((previous) =>
        append
          ? [
              ...new Map(
                [...(previous ?? []), ...result.assets].map((asset) => [
                  asset.id,
                  asset,
                ])
              ).values(),
            ]
          : result.assets
      );
      setCursor(result.nextCursor ?? null);
    } catch (cause) {
      if (generation === queryGeneration.current)
        setError(cause instanceof Error ? cause.message : t('failed'));
    } finally {
      if (generation === queryGeneration.current) setBusy(false);
    }
  }
  function pickElement(id: string) {
    const element = document.elements[id];
    setElementId(id);
    setElementName(element?.name ?? '');
    setDescription(element?.description ?? '');
    setKind(element?.kind ?? 'character');
    setAssetId('');
    setEditRevision(null);
    setError('');
  }
  const visibleAssets =
    queried ??
    assets.filter(
      (asset) =>
        (scope === 'project' ||
          (document.assetLocations[asset.id] ?? null) === folderId) &&
        (!query ||
          (asset.filename ?? asset.id)
            .toLowerCase()
            .includes(query.toLowerCase()))
    );
  const assetOptions = [
    ...new Map(
      [...assets, ...(queried ?? [])].map((asset) => [asset.id, asset])
    ).values(),
  ].filter((asset) => asset.type === (kind === 'voice' ? 'audio' : 'image'));

  const content = (
    <div className="space-y-4 border-t border-white/10 p-4">
      <p className="text-xs text-[var(--beat-text-3)]">{t('localOnly')}</p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('title')}
      >
        <button
          type="button"
          className={button}
          aria-pressed={tab === 'folders'}
          onClick={() => setTab('folders')}
        >
          {t('folders')}
        </button>
        <button
          type="button"
          className={button}
          aria-pressed={tab === 'elements'}
          onClick={() => setTab('elements')}
        >
          {t('elements')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {stale && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-orange-500/30 p-3 text-sm"
        >
          <span>{t('conflict')}</span>
          <button
            type="button"
            className={button}
            onClick={() => {
              setEditRevision(revision);
              setPreview(null);
              setError('');
            }}
          >
            {t('reviewLatest')}
          </button>
        </div>
      )}
      {tab === 'folders' ? (
        <>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void search({ folderId, scope, query });
            }}
          >
            <label className="grid gap-1 text-xs">
              {t('searchScope')}
              <select
                aria-label={t('searchScope')}
                className={control}
                value={scope}
                onChange={(event) => {
                  const nextScope = event.target.value as 'current' | 'project';
                  setScope(nextScope);
                  setQueried(null);
                  setCursor(null);
                  void search({ folderId, scope: nextScope, query });
                }}
              >
                <option value="project">{t('allAssets')}</option>
                <option value="current">{t('currentFolder')}</option>
              </select>
            </label>
            <label className="grid min-w-44 flex-1 gap-1 text-xs">
              {t('folder')}
              <select
                aria-label={t('folder')}
                className={control}
                value={folderId ?? ''}
                onChange={(event) => {
                  const next = event.target.value || null;
                  setFolderId(next);
                  setScope('current');
                  setQueried(null);
                  setCursor(null);
                  setPreview(null);
                  setEditRevision(null);
                  void search({ folderId: next, scope: 'current', query });
                }}
              >
                <option value="">{t('unclassified')}</option>
                {folders.map((folder) => (
                  <option value={folder.id} key={folder.id}>
                    {folderPath(folder.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-44 flex-1 gap-1 text-xs">
              {t('search')}
              <input
                className={control}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className={`${button} self-end`}
              disabled={busy}
              type="submit"
            >
              {t('search')}
            </button>
          </form>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void apply([
                {
                  type: 'create_folder',
                  folderId: crypto.randomUUID(),
                  name: folderName,
                  parentId: folderId,
                },
              ]);
            }}
          >
            <label className="grid min-w-44 flex-1 gap-1 text-xs">
              {t('folderName')}
              <input
                className={control}
                maxLength={200}
                value={folderName}
                onChange={(event) => {
                  markEdit();
                  setFolderName(event.target.value);
                }}
              />
            </label>
            <button
              type="submit"
              className={`${button} self-end`}
              disabled={busy || !folderName.trim() || stale}
            >
              {t('createFolder')}
            </button>
            <button
              type="button"
              className={`${button} self-end`}
              disabled={busy || !folderId || !folderName.trim() || stale}
              onClick={() =>
                folderId &&
                void apply([
                  { type: 'rename_folder', folderId, name: folderName },
                ])
              }
            >
              {t('rename')}
            </button>
            <button
              type="button"
              className={`${button} self-end`}
              disabled={busy || !folderId}
              onClick={() => {
                if (folderId) {
                  setPreview(
                    previewFolderRemoval(document, folderId, revision)
                  );
                  setEditRevision(revision);
                }
              }}
            >
              {t('removeFolder')}
            </button>
          </form>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-44 flex-1 gap-1 text-xs">
              {t('destination')}
              <select
                aria-label={t('destination')}
                className={control}
                value={destination}
                onChange={(event) => {
                  markEdit();
                  setDestination(event.target.value);
                }}
              >
                <option value="">{t('unclassified')}</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folderPath(folder.id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={button}
              disabled={busy || !folderId || stale}
              onClick={() =>
                folderId &&
                void apply([
                  {
                    type: 'move_folder',
                    folderId,
                    parentId: destination || null,
                  },
                ])
              }
            >
              {t('moveFolder')}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || !selected.length || stale}
              onClick={() =>
                void apply([
                  {
                    type: 'assign_assets',
                    assetIds: selected,
                    folderId: destination || null,
                  },
                ])
              }
            >
              {t('moveSelected', { count: selected.length })}
            </button>
          </div>
          {preview && (
            <section
              className="space-y-2 rounded-lg border border-orange-500/30 p-3"
              aria-label={t('removalPreview')}
            >
              <p className="text-sm">
                {t('removalSummary', {
                  assets: preview.assetIds.length,
                  folders: preview.childFolderIds.length,
                  destination: preview.parentId
                    ? folderPath(preview.parentId)
                    : t('unclassified'),
                })}
              </p>
              <ul className="max-h-40 overflow-auto text-xs">
                {preview.assetIds.map((id) => (
                  <li key={id}>
                    {assets.find((asset) => asset.id === id)?.filename ?? id}
                  </li>
                ))}
                {preview.childFolderIds.map((id) => (
                  <li key={id}>{folderPath(id)}</li>
                ))}
              </ul>
              {preview.conflicts.length > 0 && (
                <p role="alert">{t('nameConflicts')}</p>
              )}
              <button
                type="button"
                className={button}
                disabled={busy || stale || preview.conflicts.length > 0}
                onClick={() =>
                  void apply([
                    {
                      type: 'remove_folder',
                      folderId: preview.folderId,
                      previewRevision: preview.organizationRevision,
                    },
                  ])
                }
              >
                {t('confirmRemove')}
              </button>{' '}
              <button
                type="button"
                className={button}
                onClick={() => setPreview(null)}
              >
                {t('cancel')}
              </button>
            </section>
          )}
          <ul
            className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2"
            aria-label={t('assets')}
          >
            {[
              ...new Map(
                visibleAssets.map((asset) => [asset.id, asset])
              ).values(),
            ].map((asset) => (
              <li
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3"
                key={asset.id}
              >
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(asset.id)}
                    onChange={(event) => {
                      markEdit();
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, asset.id]
                          : current.filter((id) => id !== asset.id)
                      );
                    }}
                  />
                  <span className="truncate">
                    {asset.filename ?? asset.id}
                    <small className="block truncate text-[var(--beat-text-3)]">
                      {document.assetLocations[asset.id]
                        ? folderPath(document.assetLocations[asset.id])
                        : t('unclassified')}
                    </small>
                  </span>
                </label>
                {onLocate && (
                  <button
                    type="button"
                    className={button}
                    onClick={() => onLocate(asset.id)}
                  >
                    {t('locate')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!visibleAssets.length && (
            <p className="text-sm text-[var(--beat-text-3)]">{t('noAssets')}</p>
          )}
          {cursor && (
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() =>
                void search({ folderId, scope, query, cursor }, true)
              }
            >
              {t('loadMore')}
            </button>
          )}
        </>
      ) : (
        <>
          <label className="grid gap-1 text-xs">
            {t('element')}
            <select
              aria-label={t('element')}
              className={control}
              value={elementId}
              onChange={(event) => pickElement(event.target.value)}
            >
              <option value="">{t('newElement')}</option>
              {activeElements.map((element) => (
                <option key={element.id} value={element.id}>
                  {element.name}
                </option>
              ))}
            </select>
          </label>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (elementId)
                void apply([
                  {
                    type: 'update_element',
                    elementId,
                    name: elementName,
                    description,
                  },
                ]);
              else
                void apply([
                  {
                    type: 'create_element',
                    elementId: crypto.randomUUID(),
                    name: elementName,
                    kind,
                    description,
                    versionId: crypto.randomUUID(),
                    assetId,
                  },
                ]);
            }}
          >
            <label className="grid gap-1 text-xs">
              {t('name')}
              <input
                className={control}
                maxLength={200}
                value={elementName}
                onChange={(event) => {
                  markEdit();
                  setElementName(event.target.value);
                }}
              />
            </label>
            <label className="grid gap-1 text-xs">
              {t('kind')}
              <select
                aria-label={t('kind')}
                className={control}
                value={kind}
                disabled={!!elementId}
                onChange={(event) => {
                  markEdit();
                  setKind(event.target.value as typeof kind);
                  setAssetId('');
                }}
              >
                {(['character', 'scene', 'prop', 'voice'] as const).map(
                  (value) => (
                    <option value={value} key={value}>
                      {t(value)}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              {t('description')}
              <textarea
                className={`${control} py-2`}
                maxLength={2000}
                value={description}
                onChange={(event) => {
                  markEdit();
                  setDescription(event.target.value);
                }}
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              {t('sourceAsset')}
              <select
                aria-label={t('sourceAsset')}
                className={control}
                value={assetId}
                onChange={(event) => {
                  markEdit();
                  setAssetId(event.target.value);
                }}
              >
                <option value="">{t('chooseAsset')}</option>
                {assetOptions.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.filename ?? asset.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={button}
              disabled={
                busy || stale || !elementName.trim() || (!elementId && !assetId)
              }
            >
              {elementId ? t('save') : t('createElement')}
            </button>
            {elementId && (
              <button
                type="button"
                className={button}
                disabled={busy || stale || !assetId}
                onClick={() =>
                  void apply([
                    {
                      type: 'add_element_version',
                      elementId,
                      versionId: crypto.randomUUID(),
                      assetId,
                    },
                  ])
                }
              >
                {t('addVersion')}
              </button>
            )}
          </form>
          {currentElement && (
            <section className="space-y-2" aria-label={t('versions')}>
              <p className="text-xs text-[var(--beat-text-3)]">
                {t('versionHelp')}
              </p>
              {Object.values(currentElement.versions).map((version) => (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-2"
                  key={version.id}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {assets.find((asset) => asset.id === version.assetId)
                      ?.filename ?? version.assetId}
                    <small className="block text-[var(--beat-text-3)]">
                      {version.id}
                    </small>
                  </span>
                  {version.id === currentElement.currentVersionId ? (
                    <span className="text-xs">{t('current')}</span>
                  ) : (
                    <button
                      type="button"
                      className={button}
                      disabled={busy || stale}
                      onClick={() =>
                        void apply([
                          {
                            type: 'set_element_current',
                            elementId,
                            versionId: version.id,
                          },
                        ])
                      }
                    >
                      {t('setCurrent')}
                    </button>
                  )}
                  {onLocate && (
                    <button
                      type="button"
                      className={button}
                      onClick={() => onLocate(version.assetId)}
                    >
                      {t('locate')}
                    </button>
                  )}
                </div>
              ))}
              {(consumers ?? []).some(
                (consumer) => consumer.elementId === elementId
              ) && (
                <div className="space-y-1 text-xs">
                  <p>{t('referenceConsumers')}</p>
                  {(consumers ?? [])
                    .filter((consumer) => consumer.elementId === elementId)
                    .map((consumer) => (
                      <button
                        className={button}
                        type="button"
                        key={consumer.consumerCardId}
                        onClick={() =>
                          onLocateConsumer?.(consumer.consumerCardId)
                        }
                      >
                        {t('locate')} · {consumer.name}
                      </button>
                    ))}
                </div>
              )}
              <button
                type="button"
                className={button}
                disabled={busy || stale}
                onClick={() =>
                  void apply([{ type: 'remove_element', elementId }])
                }
              >
                {t('removeElement')}
              </button>
            </section>
          )}
          {deletedElements.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm">
                {t('removedElements')}
              </summary>
              <div className="space-y-2">
                {deletedElements.map((element) => (
                  <div
                    className="flex items-center justify-between gap-2 text-sm"
                    key={element.id}
                  >
                    {element.name}
                    <button
                      type="button"
                      className={button}
                      disabled={busy || stale}
                      onClick={() =>
                        void apply([
                          { type: 'restore_element', elementId: element.id },
                        ])
                      }
                    >
                      {t('restore')}
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
  if (narrow) {
    return (
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogTrigger
          render={<button type="button" className={`${button} my-6 w-full`} />}
        >
          {t('title')}
        </DialogTrigger>
        <DialogContent
          data-testid="project-organization-drawer"
          showCloseButton={false}
          className="inset-y-0 right-0 left-auto h-dvh max-h-dvh w-[min(100vw,28rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-l border-white/10 bg-[var(--beat-panel,#111214)] p-0 text-[var(--beat-text-1)]"
        >
          <div className="flex items-center justify-between gap-3 p-4">
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogClose render={<button type="button" className={button} />}>
              {t('closePanel')}
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            {t('localOnly')}
          </DialogDescription>
          {content}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <details
      className="my-6 rounded-xl border border-white/10 bg-[var(--beat-panel,#111214)] text-[var(--beat-text-1)]"
      data-testid="project-organization-panel"
    >
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
        {t('title')}
      </summary>
      {content}
    </details>
  );
}
