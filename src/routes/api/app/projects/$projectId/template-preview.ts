import { createFileRoute } from '@tanstack/react-router';
import { getActiveProject } from '@/core/projects/projects';
import { BeatDesignCommandError } from '@/core/commands/contracts';
import {
  previewWorkflowTemplate,
  previewWorkflowInstantiation,
} from '@/core/workflows/service';
import { templatePreviewInputSchema } from '@/core/workflows/template-preview-contract';
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
  if (!trust.ok)
    return Response.json({ error: trust.message }, { status: trust.status });
  let input: unknown;
  try {
    input = await readRequestJsonWithLimit(request, 128 * 1024);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestBodyTooLargeError
            ? 'Preview request is too large'
            : 'Invalid JSON',
      },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
    );
  }
  const parsed = templatePreviewInputSchema.safeParse(input);
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid template preview' },
      { status: 400 }
    );
  try {
    if (!(await getActiveProject({ projectId: params.projectId })))
      throw new BeatDesignCommandError('NOT_FOUND', 'Project not found');
    const preview = parsed.data;
    const result =
      'selectedCardIds' in preview
        ? await previewWorkflowTemplate(
            params.projectId,
            preview.selectedCardIds
          )
        : await previewWorkflowInstantiation(params.projectId, preview);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof BeatDesignCommandError)
      return Response.json(
        { error: error.message },
        {
          status:
            error.code === 'NOT_FOUND'
              ? 404
              : error.code === 'REVISION_CONFLICT'
                ? 409
                : 400,
        }
      );
    if (error instanceof Error)
      return Response.json({ error: error.message }, { status: 400 });
    return Response.json(
      { error: 'Unable to preview workflow template' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/template-preview'
)({ server: { handlers: { POST } } });
