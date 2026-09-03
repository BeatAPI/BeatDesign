import { useState } from 'react';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import { normalizeLocale } from '@/config/locale';
import type { WorkspaceMode } from '@/config/workspace-modes';
import { buildPostCreateProjectDetailPath } from '@/core/projects/project-entry';
import { apiJsonPost } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';

type CreateProjectResponse = {
  id?: string;
  name?: string;
  error?: string;
};

export type CreateProjectRouteData = {
  locale: string;
  target: string | null;
  model: string | null;
  prompt: string | null;
  workspaceMode: WorkspaceMode;
  projectName: string;
};

function getCopy(locale: string) {
  const messageLocale = normalizeLocale(locale);
  return {
    title: m['BeatAPI.project.newTitle']({}, { locale: messageLocale }),
    description: m['BeatAPI.project.newDescription'](
      {},
      { locale: messageLocale }
    ),
    errorTitle: m['BeatAPI.project.newErrorTitle'](
      {},
      { locale: messageLocale }
    ),
    retry: m['BeatAPI.project.retry']({}, { locale: messageLocale }),
    startTitle: m['BeatAPI.project.startTitle']({}, { locale: messageLocale }),
    startDescription: m['BeatAPI.project.startDescription'](
      {},
      { locale: messageLocale }
    ),
    startStudio: m['BeatAPI.project.startStudio'](
      {},
      { locale: messageLocale }
    ),
    startCanvas: m['BeatAPI.project.startCanvas'](
      {},
      { locale: messageLocale }
    ),
  };
}

export function CreateProjectRoutePage({
  data,
}: {
  data: CreateProjectRouteData;
}) {
  const { locale, target, model, prompt, projectName } = data;
  const copy = getCopy(locale);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProject(workspaceMode: WorkspaceMode) {
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      const payload = await apiJsonPost<CreateProjectResponse>(
        '/api/app/projects',
        { name: projectName, workspaceMode }
      );

      if (!payload?.id) {
        throw new Error(payload?.error || copy.errorTitle);
      }

      window.location.replace(
        buildPostCreateProjectDetailPath({
          locale,
          projectId: payload.id,
          target: target ?? undefined,
          model: model ?? undefined,
          prompt: prompt ?? undefined,
          mode: workspaceMode,
        })
      );
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : copy.errorTitle
      );
      setCreating(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--beat-bg)] px-6 py-16 text-[var(--beat-text-1)]">
      <section className="w-full max-w-[520px] rounded-[var(--beat-radius)] border border-white/[0.13] bg-[linear-gradient(145deg,#1b1b1e_0%,#151517_100%)] px-8 py-9 text-center shadow-[0_30px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.035)]">
        {error ? (
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertCircleIcon className="size-6" />
          </div>
        ) : creating ? (
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[rgba(255,122,51,0.12)] text-[var(--beat-accent)]">
            <Loader2Icon className="size-6 animate-spin" />
          </div>
        ) : (
          <img
            src={appConfig.app_logo}
            alt={appConfig.app_name}
            className="mx-auto size-12 rounded-[14px] object-contain"
          />
        )}

        <h1 className="beat-product-display mt-5 text-[28px] font-semibold tracking-[-0.045em]">
          {error ? copy.errorTitle : creating ? copy.title : copy.startTitle}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--beat-text-2)]">
          {error || (creating ? copy.description : copy.startDescription)}
        </p>

        {!creating ? (
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {error ? (
              <Button
                type="button"
                className="h-11 rounded-[var(--beat-radius-sm)] bg-[var(--beat-accent)] px-5 text-[var(--beat-accent-ink)] hover:bg-[var(--beat-accent-hover)]"
                onClick={() => void createProject('studio')}
              >
                {copy.retry}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  className="h-11 rounded-[var(--beat-radius-sm)] bg-[var(--beat-accent)] px-5 text-[var(--beat-accent-ink)] hover:bg-[var(--beat-accent-hover)]"
                  onClick={() => void createProject('studio')}
                >
                  {copy.startStudio}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-[16px] border-white/[0.16] bg-transparent px-5 text-white hover:bg-white/[0.06]"
                  onClick={() => void createProject('canvas')}
                >
                  {copy.startCanvas}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
