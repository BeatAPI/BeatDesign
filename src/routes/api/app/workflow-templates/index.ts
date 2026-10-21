import { createFileRoute } from '@tanstack/react-router';
import { listWorkflowTemplates } from '@/core/workflows/service';

async function GET({ request }: { request: Request }) {
  try {
    const templates = await listWorkflowTemplates();
    // Hash public summaries only; media and project state never enter this endpoint.
    const { createHash } = await import('node:crypto');
    const etag = `"${createHash('sha256').update(JSON.stringify(templates)).digest('hex')}"`;
    const headers = { etag, 'cache-control': 'private, no-cache' };
    if (
      request.headers
        .get('if-none-match')
        ?.split(',')
        .map((value) => value.trim())
        .includes(etag)
    )
      return new Response(null, { status: 304, headers });
    return Response.json({ templates }, { headers });
  } catch {
    return Response.json(
      { error: 'Unable to list local workflow templates' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute('/api/app/workflow-templates/')({
  server: { handlers: { GET } },
});
