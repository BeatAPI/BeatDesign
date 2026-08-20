import { createFileRoute } from '@tanstack/react-router';

/**
 * It is used to check if the server is running.
 * You can use tools like Uptime Kuma to monitor this endpoint.
 */
async function GET() {
  return Response.json({ message: 'pong' });
}

export const Route = createFileRoute('/api/ping')({
  server: {
    handlers: { GET },
  },
});
