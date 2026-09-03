import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Images, LayoutPanelTop, Scissors, Workflow } from 'lucide-react';

import { WorkspaceApiConfigDialog } from '@/components/app/workspace-api-config-dialog';
import { LanguageSwitcher } from '@/components/app/language-switcher';
import { GitHubIcon } from '@/components/icons/github';
import { Link } from '@/core/i18n/navigation';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { apiJsonPatch, apiJsonPost } from '@/lib/api-client';
import { appConfig } from '@/config';
import { ACTIVE_GENERATION_PROVIDER_ID } from '@/config/generation-providers';
import type { WorkspaceMode } from '@/config/workspace-modes';

export function ProductPageShell({
  children,
  workspaceName,
  projectId,
  workspaceMode,
}: {
  children: ReactNode;
  workspaceName?: string | null;
  projectId?: string | null;
  workspaceMode?: WorkspaceMode;
}) {
  const t = useTranslations('AppShell');
  const untitledWorkspaceName = t('header.untitledCanvas');
  const getDisplayWorkspaceName = useCallback(
    (name: string | null | undefined) => {
      const trimmed = name?.trim();
      return trimmed &&
        trimmed !== 'Untitled canvas' &&
        trimmed !== 'Untitled project'
        ? trimmed
        : untitledWorkspaceName;
    },
    [untitledWorkspaceName]
  );
  const defaultWorkspaceName = getDisplayWorkspaceName(workspaceName);
  const [draftWorkspaceName, setDraftWorkspaceName] =
    useState(defaultWorkspaceName);
  const lastPersistedWorkspaceNameRef = useRef(defaultWorkspaceName);

  useEffect(() => {
    const nextName = getDisplayWorkspaceName(workspaceName);
    setDraftWorkspaceName(nextName);
    lastPersistedWorkspaceNameRef.current = nextName;
  }, [getDisplayWorkspaceName, workspaceName]);

  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();
    void apiJsonPost(
      `/api/app/projects/${projectId}`,
      { workspaceMode },
      {
        signal: controller.signal,
        keepalive: true,
      }
    ).catch(() => {});

    return () => controller.abort();
  }, [projectId, workspaceMode]);

  const commitWorkspaceName = async () => {
    const nextName = draftWorkspaceName.trim() || untitledWorkspaceName;
    setDraftWorkspaceName(nextName);

    if (!projectId || nextName === lastPersistedWorkspaceNameRef.current) {
      return;
    }

    try {
      await apiJsonPatch(`/api/app/projects/${projectId}`, { name: nextName });
      lastPersistedWorkspaceNameRef.current = nextName;
    } catch (error) {
      console.error('rename project failed:', error);
      setDraftWorkspaceName(lastPersistedWorkspaceNameRef.current);
    }
  };

  const titleNode = projectId ? (
    <input
      type="text"
      value={draftWorkspaceName}
      onChange={(event) => setDraftWorkspaceName(event.target.value)}
      onBlur={() => {
        void commitWorkspaceName();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraftWorkspaceName(lastPersistedWorkspaceNameRef.current);
          event.currentTarget.blur();
        }
      }}
      aria-label={t('header.workspaceNameLabel')}
      className="h-9 w-full min-w-0 truncate rounded-md border-0 bg-transparent px-0 text-[15px] font-semibold text-[var(--beat-text-1)] outline-none placeholder:text-white/35 focus:ring-0"
    />
  ) : (
    <span className="block truncate text-[15px] font-semibold text-[var(--beat-text-1)]">
      {workspaceName?.trim() || t('header.projects')}
    </span>
  );
  const workspaceTabClassName = (isActive: boolean) =>
    `inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition sm:px-3 ${
      isActive
        ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
        : 'text-[var(--beat-text-2)] hover:bg-white/[0.045] hover:text-white'
    }`;

  return (
    <div className="beat-product-shell flex h-screen min-h-screen flex-col overflow-hidden bg-[var(--beat-bg)] text-[var(--beat-text-1)]">
      <header className="pointer-events-auto sticky top-0 z-40 shrink-0 border-b border-white/[0.07] bg-[var(--beat-surface)]/96 text-[var(--beat-text-1)] backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link
                href="/"
                aria-label={t('header.backHome')}
                className="inline-flex size-9 items-center justify-center rounded-xl text-[var(--beat-text-1)] transition hover:bg-white/[0.06]"
              >
                <img
                  src={appConfig.app_logo}
                  alt={appConfig.app_name}
                  className="size-7 rounded-xl object-contain"
                />
              </Link>

              <div className="hidden min-w-0 flex-1 sm:block">
                <div className="min-w-0 flex-1">{titleNode}</div>
              </div>
            </div>

            <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
              {projectId && workspaceMode ? (
                <nav
                  className="flex items-center rounded-full border border-white/[0.09] bg-white/[0.035] p-1"
                  aria-label={t('header.workspaceView')}
                >
                  <Link
                    href={`/studio/${projectId}`}
                    aria-current={workspaceMode === 'studio' ? 'page' : undefined}
                    aria-label={t('header.studio')}
                    className={workspaceTabClassName(workspaceMode === 'studio')}
                  >
                    <LayoutPanelTop className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('header.studio')}</span>
                  </Link>
                  <Link
                    href={`/canvas/${projectId}`}
                    aria-current={workspaceMode === 'canvas' ? 'page' : undefined}
                    aria-label={t('header.canvas')}
                    className={workspaceTabClassName(workspaceMode === 'canvas')}
                  >
                    <Workflow className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('header.canvas')}</span>
                  </Link>
                  <Link
                    href={`/editor/${projectId}`}
                    aria-current={workspaceMode === 'editor' ? 'page' : undefined}
                    aria-label={t('header.editor')}
                    className={workspaceTabClassName(workspaceMode === 'editor')}
                  >
                    <Scissors className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('header.editor')}</span>
                  </Link>
                  <Link
                    href={`/assets/${projectId}`}
                    aria-current={workspaceMode === 'assets' ? 'page' : undefined}
                    aria-label={t('header.assets')}
                    className={workspaceTabClassName(workspaceMode === 'assets')}
                  >
                    <Images className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('header.assets')}</span>
                  </Link>
                </nav>
              ) : null}
              <LanguageSwitcher variant="workspace" />
              <WorkspaceApiConfigDialog
                providerId={ACTIVE_GENERATION_PROVIDER_ID}
              />
              <a
                href="https://github.com/BeatAPI/BeatDesign"
                target="_blank"
                rel="noreferrer"
                aria-label={t('header.githubRepository')}
                title={t('header.githubRepository')}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] text-[var(--beat-text-2)] transition hover:border-white/[0.16] hover:bg-white/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--beat-graph)]/70"
              >
                <GitHubIcon className="size-[17px]" aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
