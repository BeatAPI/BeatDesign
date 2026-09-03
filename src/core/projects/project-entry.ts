import type { Locale } from '@/core/workspace-lib/shims/next-intl';
import {
  resolveWorkspaceMode,
  workspaceModePath,
} from '@/config/workspace-modes';
import { formatProjectActivityDate } from './format-project-activity-date';

const getLocalizedRoute = (route: string, locale?: string | null) =>
  locale === 'zh' ? `/zh${route === '/' ? '' : route}` : route;

export type ProjectEntryIntent = {
  target?: string;
  model?: string;
  prompt?: string;
  focus?: string;
};

type ProjectWorkspaceIntent = ProjectEntryIntent & {
  mode?: string;
};

const applyProjectEntryIntent = (
  searchParams: URLSearchParams,
  intent: ProjectEntryIntent
) => {
  if (intent.target) {
    searchParams.set('target', intent.target);
  }
  if (intent.model) {
    searchParams.set('model', intent.model);
  }
  if (intent.prompt) {
    searchParams.set('prompt', intent.prompt);
  }
  if (intent.focus) {
    searchParams.set('focus', intent.focus);
  }
  return searchParams;
};

export function buildProjectEntrySearchParams(intent: ProjectEntryIntent = {}) {
  return applyProjectEntryIntent(new URLSearchParams(), intent);
}

export function parseProjectEntryIntent(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): ProjectEntryIntent {
  const readValue = (key: keyof ProjectEntryIntent) => {
    if (input instanceof URLSearchParams) {
      return input.get(key) ?? undefined;
    }

    const value = input[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    target: readValue('target'),
    model: readValue('model'),
    prompt: readValue('prompt'),
    focus: readValue('focus'),
  };
}

export function buildCreateProjectPath({ ...intent }: ProjectWorkspaceIntent = {}) {
  const { mode, ...searchIntent } = intent;
  const searchParams = buildProjectEntrySearchParams(searchIntent);
  const query = searchParams.toString();
  const workspacePath = workspaceModePath(resolveWorkspaceMode(mode));
  return query ? `${workspacePath}?${query}` : workspacePath;
}

export function buildLocalizedCreateProjectPath({
  locale,
  ...params
}: ProjectWorkspaceIntent & {
  locale?: Locale | string | null;
}) {
  return getLocalizedRoute(buildCreateProjectPath(params), locale);
}

export function buildProjectDetailPath(projectId: string, mode?: string) {
  return `${workspaceModePath(resolveWorkspaceMode(mode))}/${projectId}`;
}

export function buildProjectDetailPathWithIntent({
  projectId,
  ...intent
}: ProjectWorkspaceIntent & {
  projectId: string;
}) {
  const { mode, ...searchIntent } = intent;
  const searchParams = buildProjectEntrySearchParams(searchIntent);
  const pathname = buildProjectDetailPath(projectId, mode);
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildLocalizedProjectDetailPath({
  locale,
  projectId,
  ...intent
}: ProjectWorkspaceIntent & {
  projectId: string;
  locale?: Locale | string | null;
}) {
  return getLocalizedRoute(
    buildProjectDetailPathWithIntent({
      projectId,
      ...intent,
    }),
    locale
  );
}

export function buildPostCreateProjectDetailPath({
  locale,
  projectId,
  target,
  model,
  prompt,
  mode,
}: ProjectWorkspaceIntent & {
  projectId: string;
  locale?: Locale | string | null;
}) {
  return buildLocalizedProjectDetailPath({
    locale,
    projectId,
    target,
    model,
    prompt,
    mode,
  });
}

export function getProjectActivityDate(project: {
  lastOpenedAt?: Date | null;
  updatedAt: Date;
}) {
  return project.lastOpenedAt ?? project.updatedAt;
}

export function serializeProjectCenterCard(project: {
  id: string;
  name: string;
  lastWorkspaceMode?: string | null;
  lastOpenedAt?: Date | null;
  updatedAt: Date;
  coverImageUrl?: string | null;
}) {
  const activityAt = getProjectActivityDate(project);

  return {
    id: project.id,
    name: project.name,
    lastWorkspaceMode: resolveWorkspaceMode(project.lastWorkspaceMode),
    activityAt: activityAt.toISOString(),
    activityLabel: formatProjectActivityDate(activityAt),
    coverImageUrl: project.coverImageUrl ?? null,
  };
}
