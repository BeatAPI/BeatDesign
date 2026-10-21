import { createFileRoute } from '@tanstack/react-router';
import {
  resolveWorkspaceMode,
  type WorkspaceMode,
} from '@/config/workspace-modes';
import {
  getProject,
  markProjectOpened,
} from '@/core/projects/projects';
import { getProjectSettings } from '@/core/projects/project-settings';
import { persistBeatDesignCommand } from '@/core/commands/persist';
import { projectSettingsPatchSchema } from '@/core/projects/project-settings-contract';
import { z } from 'zod';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';
import {
  MAX_WORKSPACE_JSON_REQUEST_BYTES,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';

type OpenProjectRequest = {
  workspaceMode?: string;
};

async function POST({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  const { projectId } = params;
  let payload: OpenProjectRequest = {};
  try {
    payload = await readRequestJsonWithLimit<OpenProjectRequest>(
      request,
      MAX_WORKSPACE_JSON_REQUEST_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const workspaceMode: WorkspaceMode | undefined = payload.workspaceMode
    ? resolveWorkspaceMode(payload.workspaceMode)
    : undefined;
  const currentProject = await getProject({ projectId });

  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  await markProjectOpened({
    projectId,
    workspaceMode,
  });

  return Response.json({
    id: projectId,
    lastOpenedAt: new Date().toISOString(),
    workspaceMode,
  });
}

async function PATCH({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  const { projectId } = params;
  const currentProject = await getProject({ projectId });

  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await readRequestJsonWithLimit<unknown>(request, MAX_WORKSPACE_JSON_REQUEST_BYTES);
  } catch (error) {
    return Response.json({ error: error instanceof RequestBodyTooLargeError ? 'Request body is too large' : 'Invalid JSON' }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }
  const parsed = z.object({ patch: projectSettingsPatchSchema, expectedRevision: z.number().int().min(1), commandId: z.string().min(1).max(200).optional() }).strict().safeParse(payload);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 400 });
  const result = await persistBeatDesignCommand({ projectId, origin: 'ui', expectedRevision: parsed.data.expectedRevision, commandId: parsed.data.commandId, command: { type: 'project.update', patch: parsed.data.patch } });
  return Response.json(result, { status: result.ok ? 200 : result.code === 'REVISION_CONFLICT' ? 409 : result.code === 'NOT_FOUND' ? 404 : 400 });
}

async function GET({ params }: { params: { projectId: string } }) {
  const settings = await getProjectSettings(params.projectId);
  return settings ? Response.json({ settings }) : Response.json({ error: 'Project not found' }, { status: 404 });
}

export const Route = createFileRoute('/api/app/projects/$projectId')({
  server: { handlers: { GET, POST, PATCH } },
});
