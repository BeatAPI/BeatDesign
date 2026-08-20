'use client';

import { Link } from '@/core/i18n/navigation';
import { buildLocalizedProjectDetailPath } from '@/core/projects/project-entry';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Check,
  CheckSquare,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { startTransition, useDeferredValue, useMemo, useState } from 'react';

export type WorkspaceProjectCardItem = {
  id: string;
  name: string;
  lastWorkspaceMode?: 'studio' | 'canvas';
  activityAt: string;
  activityLabel: string;
  coverImageUrl?: string | null;
};

export type WorkspaceProjectHubHandle = {
  deleteProjects: (ids: string[]) => Promise<void>;
};

const PROJECT_CARD_LINK_CLASS_NAME = 'group block h-full';

const PROJECT_CARD_PREVIEW_FRAME_CLASS_NAME =
  'overflow-hidden rounded-[18px] border border-[#E6EBF2] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition';

const PROJECT_CARD_CLASS_NAME = `${PROJECT_CARD_PREVIEW_FRAME_CLASS_NAME} group-hover:-translate-y-0.5 group-hover:border-[#C8D6FA] group-hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)]`;

const NEW_PROJECT_CARD_CLASS_NAME =
  'relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-[#C8D6FA] bg-[radial-gradient(circle_at_50%_0%,#FFFFFF_0%,#F6F9FF_46%,#EEF4FF_100%)] shadow-[0_12px_34px_rgba(45,107,230,0.07)] transition group-hover:-translate-y-0.5 group-hover:border-[#2D6BE6]/55 group-hover:shadow-[0_18px_45px_rgba(45,107,230,0.12)]';

const PROJECT_CARD_META_CLASS_NAME = 'flex flex-col gap-1 px-1.5 pt-3';

function getProjectDisplayName(name: string, defaultProjectName: string) {
  const trimmed = name.trim();
  return trimmed === 'Untitled canvas' ? defaultProjectName : trimmed;
}

function getRelativeActivityLabel({
  activityAt,
  fallbackLabel,
  prefix,
  t,
}: {
  activityAt: string;
  fallbackLabel: string;
  prefix: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const date = new Date(activityAt);
  const diffInHours = Math.max(
    1,
    Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60))
  );

  if (diffInHours < 24) {
    return t('hoursAgo', { prefix, count: diffInHours });
  }

  const diffInDays = Math.max(1, Math.round(diffInHours / 24));
  if (diffInDays < 14) {
    return t('daysAgo', { prefix, count: diffInDays });
  }

  return `${prefix} ${fallbackLabel}`;
}

export function WorkspaceProjectHub({
  locale,
  projects,
  createProjectHref,
  createProjectLoginHref,
  isAuthenticated = true,
  onDeleteProjects,
}: {
  locale: string;
  projects: WorkspaceProjectCardItem[];
  createProjectHref: string;
  createProjectLoginHref?: string;
  isAuthenticated?: boolean;
  onDeleteProjects?: (ids: string[]) => Promise<void>;
}) {
  const t = useTranslations('BeatAPI.workspace');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deferredSearchQuery = useDeferredValue(
    searchQuery.trim().toLowerCase()
  );
  const createLinkHref = isAuthenticated
    ? createProjectHref
    : (createProjectLoginHref ?? createProjectHref);
  const canManageProjects = isAuthenticated && projects.length > 0;
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (!deferredSearchQuery) {
        return true;
      }
      return getProjectDisplayName(project.name, t('defaultProjectName'))
        .toLowerCase()
        .includes(deferredSearchQuery);
    });
  }, [deferredSearchQuery, projects, t]);

  function toggleSelect(projectId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredProjects.map((p) => p.id)));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleDelete() {
    if (selectedIds.size === 0 || !onDeleteProjects) return;
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (selectedIds.size === 0 || !onDeleteProjects) return;
    setDeleting(true);
    try {
      await onDeleteProjects([...selectedIds]);
      setSelectedIds(new Set());
      setSelectMode(false);
    } finally {
      setDeleting(false);
    }
  }

  const projectGridClassName =
    isAuthenticated && projects.length > 0
      ? 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-4 gap-y-6 lg:grid-cols-5'
      : 'grid max-w-[240px] grid-cols-1';

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8">
      <section className="pb-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-[-0.025em] text-[#1D1D1F] lg:text-[42px]">
              {t('scope')}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#6E7683]">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:justify-end">
            <Link
              href={createLinkHref}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[#2D6BE6] px-5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_14px_30px_rgba(45,107,230,0.22)] transition hover:bg-[#1E5BD4]"
            >
              <Plus className="size-4" />
              {t('newProject')}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {canManageProjects ? (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                if (selectMode) {
                  exitSelectMode();
                } else {
                  setSelectMode(true);
                }
              }}
              className={
                selectMode
                  ? 'inline-flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[#2D6BE6]/10 px-3.5 text-sm font-medium text-[#2D6BE6] transition'
                  : 'inline-flex h-11 items-center justify-center gap-1.5 rounded-[14px] border border-[#E6EBF2] bg-white px-3.5 text-sm font-medium text-[#6E7683] transition hover:bg-[#F5F7FB] hover:text-[#1D1D1F]'
              }
              aria-label={t('select')}
              title={t('select')}
            >
              <CheckSquare className="size-4" />
              <span className="sm:hidden">{t('select')}</span>
            </button>

            <label className="flex h-11 w-full items-center gap-3 rounded-[14px] border border-[#E6EBF2] bg-white px-3.5 text-[#98A2B3] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-within:border-[#C8D6FA] sm:w-[300px]">
              <Search className="size-4" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    setSearchQuery(nextValue);
                  });
                }}
                placeholder={t('searchPlaceholder')}
                className="w-full border-0 bg-transparent text-sm text-[#1D1D1F] outline-none placeholder:text-[#A0A7B3]"
              />
            </label>
          </div>
        ) : null}

        <div className={projectGridClassName}>
          <div>
            <Link
              href={createLinkHref}
              className={PROJECT_CARD_LINK_CLASS_NAME}
            >
              <article className="flex flex-col">
                <div className={NEW_PROJECT_CARD_CLASS_NAME}>
                  <Plus className="size-7 text-[#2D6BE6] transition group-hover:scale-110" />
                </div>
                <div className={PROJECT_CARD_META_CLASS_NAME}>
                  <p className="truncate text-[15px] font-semibold text-[#1D1D1F]">
                    {t('newProject')}
                  </p>
                </div>
              </article>
            </Link>
          </div>

          {isAuthenticated && filteredProjects.length > 0
            ? filteredProjects.map((project) => {
                const activityText = getRelativeActivityLabel({
                  activityAt: project.activityAt,
                  fallbackLabel: project.activityLabel,
                  prefix: t('activityPrefix'),
                  t,
                });
                const isSelected = selectedIds.has(project.id);

                return (
                  <div
                    key={project.id}
                    className={
                      selectMode ? 'relative cursor-pointer' : undefined
                    }
                    onClick={
                      selectMode ? () => toggleSelect(project.id) : undefined
                    }
                    role={selectMode ? 'button' : undefined}
                    tabIndex={selectMode ? 0 : undefined}
                    onKeyDown={
                      selectMode
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleSelect(project.id);
                            }
                          }
                        : undefined
                    }
                  >
                    {selectMode && (
                      <div
                        className={
                          isSelected
                            ? 'absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full bg-[#2D6BE6] text-white shadow-md'
                            : 'absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full border-2 border-white bg-white/80 shadow-md backdrop-blur-sm'
                        }
                      >
                        {isSelected && (
                          <Check className="size-3.5" strokeWidth={3} />
                        )}
                      </div>
                    )}

                    <Link
                      href={
                        selectMode
                          ? '#'
                          : buildLocalizedProjectDetailPath({
                              locale,
                              projectId: project.id,
                              mode: project.lastWorkspaceMode,
                            })
                      }
                      onClick={
                        selectMode ? (e) => e.preventDefault() : undefined
                      }
                      className={PROJECT_CARD_LINK_CLASS_NAME}
                    >
                      <article className="flex flex-col">
                        <div
                          className={
                            selectMode
                              ? `${PROJECT_CARD_PREVIEW_FRAME_CLASS_NAME} ${
                                  isSelected
                                    ? 'border-[#2D6BE6] shadow-[0_12px_30px_rgba(45,107,230,0.14)] ring-1 ring-[#2D6BE6]/20'
                                    : 'group-hover:border-[#C8D6FA] group-hover:shadow-[0_10px_28px_rgba(45,107,230,0.08)]'
                                }`
                              : PROJECT_CARD_CLASS_NAME
                          }
                        >
                          {project.coverImageUrl ? (
                            <img
                              src={project.coverImageUrl}
                              alt={getProjectDisplayName(
                                project.name,
                                t('defaultProjectName')
                              )}
                              className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                            />
                          ) : (
                            <div className="flex aspect-[16/10] w-full items-center justify-center bg-[linear-gradient(135deg,#F9FAFC_0%,#EEF4FF_100%)]">
                              <span className="text-xs font-medium text-[#98A2B3]">
                                BeatAPI
                              </span>
                            </div>
                          )}
                        </div>

                        <div className={PROJECT_CARD_META_CLASS_NAME}>
                          <h2 className="truncate text-[15px] font-semibold text-[#1D1D1F]">
                            {getProjectDisplayName(
                              project.name,
                              t('defaultProjectName')
                            )}
                          </h2>
                          <p className="text-xs text-[#98A2B3]">
                            {activityText}
                          </p>
                        </div>
                      </article>
                    </Link>
                  </div>
                );
              })
            : null}

          {isAuthenticated &&
          projects.length > 0 &&
          filteredProjects.length === 0 ? (
            <article className="flex min-h-[170px] flex-col justify-center rounded-[18px] border border-dashed border-[#C8D6FA] bg-white/85 px-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
              <h2 className="text-sm font-semibold text-[#1D1D1F]">
                {t('emptyTitle')}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#6E7683]">
                {t('emptyDescription')}
              </p>
            </article>
          ) : null}
        </div>
      </section>

      {selectMode && canManageProjects ? (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#E5E5EA] bg-white px-3 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
          <button
            type="button"
            onClick={selectAll}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6E6E73] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            <CheckSquare className="size-3.5" />
            {t('selectAll')}
          </button>

          <div className="h-4 w-px bg-[#E5E5EA]" />

          <button
            type="button"
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || deleting}
            className={
              selectedIds.size > 0
                ? 'inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50'
                : 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#AEAEB2]'
            }
          >
            <Trash2 className="size-3.5" />
            {t('deleteCount', { count: selectedIds.size })}
          </button>

          <div className="h-4 w-px bg-[#E5E5EA]" />

          <button
            type="button"
            onClick={exitSelectMode}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6E6E73] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            <X className="size-3.5" />
            {t('cancel')}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setConfirmOpen(open);
        }}
        title={t('deleteConfirm', {
          count: selectedIds.size,
          plural: selectedIds.size === 1 ? '' : 's',
        })}
        description={t('deleteConfirmDescription')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  );
}
