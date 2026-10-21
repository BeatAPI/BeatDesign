import { createFileRoute } from '@tanstack/react-router';
import { BeatDesignCommandError } from '@/core/commands/contracts';
import { getWorkflowTemplate } from '@/core/workflows/service';

async function GET({ params }: { params: { templateId: string } }) {
  try {
    return Response.json(await getWorkflowTemplate(params.templateId), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof BeatDesignCommandError)
      return Response.json(
        { error: error.message },
        { status: error.code === 'NOT_FOUND' ? 404 : 400 }
      );
    return Response.json(
      { error: 'Unable to read local workflow template' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute('/api/app/workflow-templates/$templateId')(
  { server: { handlers: { GET } } }
);
