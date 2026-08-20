import { createFileRoute } from '@tanstack/react-router';
import { syncGeneration } from '@/core/effects/generation-sync';

async function GET({ request }: { request: Request }) {
  const params = new URL(request.url).searchParams;
  const wmTaskId = params.get('wmTaskId');
  const effectId = Number.parseInt(params.get('effectId') ?? '', 10);
  if (!wmTaskId || !Number.isFinite(effectId)) {
    return Response.json({ error: 'Missing wmTaskId or effectId' }, { status: 400 });
  }
  try {
    const result = await syncGeneration({ wmTaskId, effectId });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    const generation = result.generation;
    return Response.json({
      success: generation.status === 'succeeded',
      wmTaskId,
      status: generation.status,
      output: generation.output,
      error: generation.status === 'failed' ? generation.error ?? 'Generation failed.' : null,
    });
  } catch (cause) {
    console.error('effects.status error:', cause);
    return Response.json({ error: 'Failed to query task status.' }, { status: 500 });
  }
}

export const Route = createFileRoute('/api/effects/status')({
  server: { handlers: { GET } },
});
