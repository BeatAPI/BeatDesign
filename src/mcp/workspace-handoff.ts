import { appConfig } from '@/config';
import {
  resolveWorkspaceMode,
  workspaceModePath,
  type WorkspaceMode,
} from '@/config/workspace-modes';

export type BeatDesignWorkspaceHandoff = ReturnType<
  typeof buildBeatDesignWorkspaceHandoff
>;

const buildViewUrl = ({
  projectId,
  view,
  focusCardId,
  time,
}: {
  projectId: string;
  view: WorkspaceMode;
  focusCardId?: string | null;
  time?: number | null;
}) => {
  const baseUrl = appConfig.app_url.replace(/\/$/, '');
  const url = new URL(
    `${baseUrl}${workspaceModePath(view)}/${encodeURIComponent(projectId)}`
  );
  if (view === 'canvas' && focusCardId?.trim()) {
    url.searchParams.set('focus', focusCardId.trim());
  }
  if (view === 'editor' && typeof time === 'number' && Number.isFinite(time)) {
    url.searchParams.set('t', String(Math.max(0, time)));
  }
  return url.toString();
};

export function buildBeatDesignWorkspaceHandoff({
  projectId,
  name,
  view,
  focusCardId,
  time,
}: {
  projectId: string;
  name: string;
  view?: WorkspaceMode | string | null;
  focusCardId?: string | null;
  time?: number | null;
}) {
  const activeView = resolveWorkspaceMode(view);
  const urls = {
    studio: buildViewUrl({ projectId, view: 'studio' }),
    canvas: buildViewUrl({
      projectId,
      view: 'canvas',
      focusCardId,
    }),
    editor: buildViewUrl({ projectId, view: 'editor', time }),
    assets: buildViewUrl({ projectId, view: 'assets' }),
  };
  const workspaceUrl = urls[activeView];
  const browserUrl = new URL(workspaceUrl);
  browserUrl.searchParams.set('beatdesignLaunchClient', 'codex_app');
  browserUrl.searchParams.set('beatdesignLaunchSurface', 'in_app_browser');
  browserUrl.searchParams.set(
    'beatdesignLaunchRuntimeSource',
    'codex_app__local_mcp'
  );

  return {
    status: 'workspace-url' as const,
    projectId,
    name,
    view: activeView,
    workspaceUrl,
    canvasUrl: urls.canvas,
    editorUrl: urls.editor,
    studioUrl: urls.studio,
    assetsUrl: urls.assets,
    ...(focusCardId?.trim() ? { focusCardId: focusCardId.trim() } : {}),
    ...(typeof time === 'number' && Number.isFinite(time)
      ? { time: Math.max(0, time) }
      : {}),
    browserHandoff: {
      keepOpenAsDeliverable: true,
      makeVisible: true,
      preserveQueryParams: true,
      projectId,
      required: true,
      reuseExistingTab: true,
      skill: 'browser:control-in-app-browser',
      url: browserUrl.toString(),
    },
    openStrategy: {
      preferred: 'in_app_browser' as const,
      fallback: 'external_browser' as const,
      reuseExistingTab: true,
    },
    liveProject: {
      projectId,
      name,
      activeView,
      urls,
    },
  };
}

export function formatBeatDesignWorkspaceHandoff(
  handoff: BeatDesignWorkspaceHandoff
) {
  return [
    `Open BeatDesign project: [${handoff.name}](${handoff.workspaceUrl})`,
    'Codex internal Browser handoff requested: load and use the Control In App Browser skill when available. Reuse a tab already showing this BeatDesign project, otherwise open browserHandoff.url exactly. Make the Browser visible and keep the tab open as a deliverable. Use workspaceUrl for a direct Markdown or external-browser link.',
    `Project ID: ${handoff.projectId}`,
    `View: ${handoff.view}`,
  ].join('\n');
}
