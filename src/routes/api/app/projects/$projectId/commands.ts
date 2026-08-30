import { createFileRoute } from '@tanstack/react-router';

import { persistBeatDesignCommand } from '@/core/commands/persist';
import {
  createCommandFailure,
  createCommandId,
} from '@/core/commands/contracts';
import { uiCommandRequestSchema } from '@/core/commands/schema';
import { MAX_PROJECT_SNAPSHOT_BYTES } from '@/core/projects/project-snapshot';
import {
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';

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

  let input: unknown;
  try {
    input = await readRequestJsonWithLimit<unknown>(
      request,
      MAX_PROJECT_SNAPSHOT_BYTES
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body is too large' }, { status: 413 });
    }
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = uiCommandRequestSchema.safeParse(input);
  if (!parsed.success) {
    const source =
      input && typeof input === 'object'
        ? (input as { commandId?: unknown })
        : null;
    const commandId =
      typeof source?.commandId === 'string' && source.commandId.trim()
        ? source.commandId.trim()
        : createCommandId();
    return Response.json(
      createCommandFailure({
        commandId,
        projectId: params.projectId,
        origin: 'ui',
        code: 'INVALID_COMMAND',
        message: parsed.error.issues[0]?.message ?? 'Command is invalid.',
      }),
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const commandId = payload.commandId ?? createCommandId();

  const result = await persistBeatDesignCommand({
    projectId: params.projectId,
    origin: 'ui',
    commandId,
    expectedRevision: payload.expectedRevision,
    idempotencyKey: payload.idempotencyKey ?? commandId,
    command: payload.command,
  });

  const status = result.ok
    ? 200
    : result.code === 'NOT_FOUND'
      ? 404
      : result.code === 'REVISION_CONFLICT'
        ? 409
        : 400;
  return Response.json(result, { status });
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/commands'
)({
  server: { handlers: { POST } },
});
