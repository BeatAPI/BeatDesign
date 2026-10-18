import { createFileRoute } from '@tanstack/react-router';
import { getProjectVideoThumbnailResponse } from '@/core/projects/project-video-thumbnail';

export const Route = createFileRoute('/api/app/projects/$projectId/assets/$assetId/thumbnail')({
  server: { handlers: { GET: ({ request, params }) => getProjectVideoThumbnailResponse(request, params) } },
});
