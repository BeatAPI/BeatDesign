import { useState } from 'react';
import {
  AlertCircleIcon,
  LayoutPanelTopIcon,
  Loader2Icon,
  WorkflowIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { WorkspaceMode } from '@/config/workspace-modes';
import { buildPostCreateProjectDetailPath } from '@/core/projects/project-entry';
import { useLocaleRouter } from '@/core/i18n/navigation';
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
  const messageLocale = locale.startsWith('zh') ? 'zh' : 'en';
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
    back: m['BeatAPI.project.backToHistory']({}, { locale: messageLocale }),
    startTitle: m['BeatAPI.project.startTitle']({}, { locale: messageLocale }),
    startStudioDescription: m['BeatAPI.project.startStudioDescription'](
      {},
      { locale: messageLocale }
    ),
    startCanvasDescription: m['BeatAPI.project.startCanvasDescription'](
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
  const {
    locale,
    target,
    model,
    prompt,
    workspaceMode,
    projectName,
  } = data;
  const router = useLocaleRouter();
  const copy = getCopy(locale);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProject() {
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

  const isStudio = workspaceMode === 'studio';
  const description = isStudio
    ? copy.startStudioDescription
    : copy.startCanvasDescription;
  const startLabel = isStudio ? copy.startStudio : copy.startCanvas;
  const WorkspaceIcon = isStudio ? LayoutPanelTopIcon : WorkflowIcon;

  return (
    <main className="flex min-h-[calc(100vh-96px)] items-center justify-center bg-[var(--beat-bg)] px-6 py-16 text-[var(--beat-text-1)]">
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
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[rgba(255,122,51,0.24)] bg-[rgba(255,122,51,0.10)] text-[var(--beat-accent)]">
            <WorkspaceIcon className="size-5" />
          </div>
        )}

        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.045em]">
          {error ? copy.errorTitle : creating ? copy.title : copy.startTitle}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--beat-text-2)]">
          {error || (creating ? copy.description : description)}
        </p>

        {!creating ? (
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              className="h-11 rounded-[var(--beat-radius-sm)] bg-[var(--beat-accent)] px-5 text-[var(--beat-accent-ink)] hover:bg-[var(--beat-accent-hover)]"
              onClick={() => void createProject()}
            >
              {error ? copy.retry : startLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[16px] border-white/[0.16] bg-transparent px-5 text-white hover:bg-white/[0.06]"
              onClick={() => router.replace('/projects')}
            >
              {copy.back}
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
