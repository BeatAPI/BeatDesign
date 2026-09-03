import type { WorkspaceMode } from '@/config/workspace-modes';
import { normalizeLocale } from '@/config/locale';
import {
  parseProjectEntryIntent,
} from '@/core/projects/project-entry';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';
import { m } from '@/paraglide/messages.js';

export async function loadCreateProjectRoute(
  search: Record<string, string | undefined>,
  workspaceMode: WorkspaceMode
) {
  const locale = getLocale();
  const { target, model, prompt } = parseProjectEntryIntent(search);
  const resolvedPrompt = prompt?.trim() || undefined;
  const messageLocale = normalizeLocale(locale);
  const projectName = resolvedPrompt
    ? resolvedPrompt.slice(0, 48)
    : m['BeatAPI.project.defaultName']({}, { locale: messageLocale });

  return {
    locale,
    target: target ?? null,
    model: model ?? null,
    prompt: prompt ?? null,
    workspaceMode,
    projectName,
  };
}
