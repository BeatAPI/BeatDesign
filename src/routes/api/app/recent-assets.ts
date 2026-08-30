import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { projectAssetMembership, userAsset } from '@/config/db/schema';
import { getProject } from '@/core/projects/projects';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

async function GET({ request }: { request: Request }) {
    const db = await getDb();
    const projectId =
      new URL(request.url).searchParams.get('projectId')?.trim() || null;

    if (projectId) {
      const currentProject = await getProject({ projectId });
      if (!currentProject) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const imageFields = {
      id: userAsset.id,
      publicUrl: userAsset.publicUrl,
      filename: userAsset.filename,
      width: userAsset.width,
      height: userAsset.height,
      createdAt: userAsset.createdAt,
      mimeType: userAsset.mimeType,
      assetClass: userAsset.assetClass,
      metadata: userAsset.metadata,
    };
    const videoFields = {
      ...imageFields,
      durationMs: userAsset.durationMs,
    };

    const imageQuery = projectId
      ? db
          .selectDistinct(imageFields)
          .from(userAsset)
          .innerJoin(
            projectAssetMembership,
            eq(projectAssetMembership.assetId, userAsset.id)
          )
          .where(
            and(
              eq(projectAssetMembership.projectId, projectId),
              eq(userAsset.type, 'image'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30)
      : db
          .select(imageFields)
          .from(userAsset)
          .where(
            and(
              eq(userAsset.type, 'image'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30);

    const videoQuery = projectId
      ? db
          .selectDistinct(videoFields)
          .from(userAsset)
          .innerJoin(
            projectAssetMembership,
            eq(projectAssetMembership.assetId, userAsset.id)
          )
          .where(
            and(
              eq(projectAssetMembership.projectId, projectId),
              eq(userAsset.type, 'video'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30)
      : db
          .select(videoFields)
          .from(userAsset)
          .where(
            and(
              eq(userAsset.type, 'video'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30);

    const audioQuery = projectId
      ? db
          .selectDistinct(videoFields)
          .from(userAsset)
          .innerJoin(
            projectAssetMembership,
            eq(projectAssetMembership.assetId, userAsset.id)
          )
          .where(
            and(
              eq(projectAssetMembership.projectId, projectId),
              eq(userAsset.type, 'audio'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30)
      : db
          .select(videoFields)
          .from(userAsset)
          .where(
            and(
              eq(userAsset.type, 'audio'),
              isNotNull(userAsset.publicUrl)
            )
          )
          .orderBy(desc(userAsset.createdAt))
          .limit(30);

    const [images, videos, audios] = await Promise.all([
      imageQuery,
      videoQuery,
      audioQuery,
    ]);

    return Response.json({ images, videos, audios });
}

export const Route = createFileRoute('/api/app/recent-assets')({
  server: {
    handlers: { GET },
  },
});
