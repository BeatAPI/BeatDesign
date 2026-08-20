import { createFileRoute } from '@tanstack/react-router';
import { getEffectsByIds } from '@/core/effects/effects';

type EffectRow = {
  id: number;
  name: string;
  inputSchema: unknown;
};

const parseIds = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const ids = parseIds(searchParams.get('ids'));

  if (ids.length === 0) {
    return Response.json({ error: 'ids is required' }, { status: 400 });
  }

  const effects: EffectRow[] = await getEffectsByIds(ids);
  const metadata = Object.fromEntries(
    effects.map((item) => [
      String(item.id),
      {
        id: item.id,
        name: item.name,
        inputSchema: item.inputSchema,
      },
    ])
  );

  return Response.json({
    effects: metadata,
  });
}

export const Route = createFileRoute('/api/effects/metadata')({
  server: {
    handlers: { GET },
  },
});
