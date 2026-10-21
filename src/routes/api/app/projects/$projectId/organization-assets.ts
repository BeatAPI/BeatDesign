import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { queryOrganizationAssets } from '@/core/organization/service';
import { BeatDesignCommandError } from '@/core/commands/contracts';

const querySchema = z
  .object({
    folderId: z
      .string()
      .max(200)
      .transform((value) => value || null)
      .optional(),
    scope: z.enum(['current', 'project']).default('project'),
    query: z.string().max(500).default(''),
    cursor: z.string().min(1).max(8192).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict();

async function GET({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid Asset query' },
      { status: 400 }
    );
  try {
    return Response.json(
      await queryOrganizationAssets(params.projectId, parsed.data),
      { headers: { 'cache-control': 'no-store' } }
    );
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
    return Response.json(
      { error: 'Unable to query project Assets' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/organization-assets'
)({ server: { handlers: { GET } } });
