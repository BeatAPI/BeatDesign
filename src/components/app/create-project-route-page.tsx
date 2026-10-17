import { AlertCircleIcon, Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import { normalizeLocale } from '@/config/locale';
import type { WorkspaceMode } from '@/config/workspace-modes';
import { useCreateProject } from '@/core/workspace-hooks/use-create-project';
import { m } from '@/paraglide/messages.js';

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
    startStudio: m['BeatAPI.project.createStudio'](
      {},
      { locale: messageLocale }
    ),
    startCanvas: m['BeatAPI.project.createCanvas'](
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
  const { locale, target, model, prompt, projectName, workspaceMode } = data;
  const copy = getCopy(locale);
  const { creating, error, createProject, retryProject } = useCreateProject({
    locale,
    projectName,
    errorMessage: copy.errorTitle,
    replace: true,
    target: target ?? undefined,
    model: model ?? undefined,
    prompt: prompt ?? undefined,
  });

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
                onClick={() => void retryProject()}
              >
                {copy.retry}
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 rounded-[var(--beat-radius-sm)] bg-[var(--beat-accent)] px-5 text-[var(--beat-accent-ink)] hover:bg-[var(--beat-accent-hover)]"
                onClick={() => void createProject(workspaceMode)}
              >
                {workspaceMode === 'studio'
                  ? copy.startStudio
                  : copy.startCanvas}
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
