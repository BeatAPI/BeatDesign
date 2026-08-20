'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutPanelTop, Workflow } from 'lucide-react';

import { WorkspaceApiConfigDialog } from '@/components/app/workspace-api-config-dialog';
import { ProjectAssetsDialog } from '@/components/app/project-assets-dialog';
import { Link } from '@/core/i18n/navigation';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { apiJsonPatch, apiJsonPost } from '@/lib/api-client';
import { envConfigs } from '@/config';
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
  const getDisplayWorkspaceName = useCallback(
    (name: string | null | undefined) => {
      const trimmed = name?.trim();
      return trimmed &&
        trimmed !== 'Untitled canvas' &&
        trimmed !== 'Untitled project'
        ? trimmed
        : t('header.untitledCanvas');
    },
    [t]
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
    const nextName = draftWorkspaceName.trim() || t('header.untitledCanvas');
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
      className="h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-0 text-[15px] font-semibold text-[var(--beat-text-1)] outline-none placeholder:text-white/35 focus:ring-0"
    />
  ) : (
    <span className="block truncate text-[15px] font-semibold text-[var(--beat-text-1)]">
      {workspaceName?.trim() || t('header.projects')}
    </span>
  );

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
                  src={envConfigs.app_logo}
                  alt={envConfigs.app_name}
                  className="size-7 rounded-xl object-contain"
                />
              </Link>

              <div className="hidden min-w-0 flex-1 sm:block">
                <div className="min-w-0 flex-1">{titleNode}</div>
              </div>
            </div>

            <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
              {projectId && workspaceMode ? (
                <div className="flex items-center rounded-full border border-white/[0.09] bg-white/[0.035] p-1" aria-label="Workspace view">
                  <Link
                    href={`/studio/${projectId}`}
                    aria-current={workspaceMode === 'studio' ? 'page' : undefined}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition sm:px-3 ${
                      workspaceMode === 'studio'
                        ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-[var(--beat-text-2)] hover:text-white'
                    }`}
                  >
                    <LayoutPanelTop className="size-3.5" /> <span className="hidden sm:inline">Studio</span>
                  </Link>
                  <Link
                    href={`/canvas/${projectId}`}
                    aria-current={workspaceMode === 'canvas' ? 'page' : undefined}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition sm:px-3 ${
                      workspaceMode === 'canvas'
                        ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-[var(--beat-text-2)] hover:text-white'
                    }`}
                  >
                    <Workflow className="size-3.5" /> <span className="hidden sm:inline">Canvas</span>
                  </Link>
                </div>
              ) : null}
              {projectId ? <ProjectAssetsDialog projectId={projectId} /> : null}
              <WorkspaceApiConfigDialog
                providerId={envConfigs.generation_provider}
              />
            </div>
          </div>
        </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
