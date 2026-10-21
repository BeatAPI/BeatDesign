import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { organizationPreview } from '@/core/organization/service';
import { OrganizationValidationError } from '@/core/organization/organization-document';
import { BeatDesignCommandError } from '@/core/commands/contracts';

const previewQuerySchema = z
  .object({
    folderId: z.string().min(1).max(200).optional(),
    elementId: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.folderId) !== Boolean(value.elementId),
    'Choose one folder or Element to preview'
  );

async function GET({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const parsed = previewQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid preview query' },
      { status: 400 }
    );
  try {
    return Response.json(
      await organizationPreview(
        params.projectId,
        parsed.data.folderId,
        parsed.data.elementId
      ),
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    if (
      error instanceof BeatDesignCommandError ||
      error instanceof OrganizationValidationError
    )
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
    return Response.json(
      { error: 'Unable to preview organization change' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/organization-preview'
)({ server: { handlers: { GET } } });
