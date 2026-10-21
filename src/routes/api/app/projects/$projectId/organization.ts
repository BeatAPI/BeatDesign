import { createFileRoute } from '@tanstack/react-router';
import {
  getOrganization,
  organizationConsumers,
} from '@/core/organization/service';
import { BeatDesignCommandError } from '@/core/commands/contracts';

async function GET({ params }: { params: { projectId: string } }) {
  try {
    const state = await getOrganization(params.projectId);
    return Response.json(
      {
        ...state,
        organizationRevision: state.revision,
        consumers: await organizationConsumers(params.projectId),
      },
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
      { error: 'Unable to read project organization' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/organization'
)({ server: { handlers: { GET } } });
