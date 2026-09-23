import { createFileRoute } from '@tanstack/react-router';
import { listGenerationModelDescriptors } from '@/core/generation-providers/model-catalog';

async function GET({ request }: { request: Request }) {
  const ids = new Set((new URL(request.url).searchParams.get('ids') ?? '').split(','));
  const effects = Object.fromEntries(listGenerationModelDescriptors()
    .filter((model) => ids.has(model.id))
    .map((model) => [model.id, { id: model.id, name: model.name, inputSchema: model.parameterSchema }]));
  return Response.json({ effects });
}
export const Route = createFileRoute('/api/effects/metadata')({ server: { handlers: { GET } } });
