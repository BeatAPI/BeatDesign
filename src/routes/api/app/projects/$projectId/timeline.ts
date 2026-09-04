import { createFileRoute } from '@tanstack/react-router';

import {
  MAX_TIMELINE_DOCUMENT_BYTES,
  normalizeTimelineDocument,
  TimelineDocumentValidationError,
  type TimelineDocument,
} from '@/core/editor/timeline-document';
import {
  loadProjectTimeline,
} from '@/core/editor/timeline-state';
import { createCommandId } from '@/core/commands/contracts';
import { persistBeatDesignCommand } from '@/core/commands/persist';
import { getProject } from '@/core/projects/projects';
import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/request-body-limit';
import { validateTrustedWorkspaceJsonMutation } from '@/lib/trusted-local-request';

async function GET({ params }: { params: { projectId: string } }) {
  const currentProject = await getProject({ projectId: params.projectId });
  if (!currentProject || currentProject.status !== 'active') {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const state = await loadProjectTimeline(params.projectId);
  return Response.json({ timeline: state });
}

async function PUT({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }

  try {
    const body = await readRequestTextWithLimit(
      request,
      MAX_TIMELINE_DOCUMENT_BYTES
    );
    const payload = JSON.parse(body) as {
      document?: TimelineDocument;
      baseVersion?: number | null;
    };
    if (!payload.document) {
      return Response.json(
        { error: 'Timeline document is required' },
        { status: 400 }
      );
    }
    const document = normalizeTimelineDocument(
      payload.document,
      params.projectId
    );
    const commandId = createCommandId();
    const result = await persistBeatDesignCommand({
      projectId: params.projectId,
      origin: 'ui',
      commandId,
      idempotencyKey: commandId,
      expectedRevision:
        typeof payload.baseVersion === 'number' ? payload.baseVersion : null,
      command: { type: 'editor.replace_document', document },
    });
    if (!result.ok) {
      return Response.json(
        { error: result.message },
        {
          status:
            result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'REVISION_CONFLICT'
                ? 409
                : 400,
        }
      );
    }
    if (!result.data.timeline) {
      return Response.json({ error: 'Timeline command returned no document' }, { status: 500 });
    }
    return Response.json({
      timeline: {
        document: result.data.timeline,
        version: result.revision,
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Timeline is too large' }, { status: 413 });
    }
    if (
      error instanceof SyntaxError ||
      error instanceof TimelineDocumentValidationError
    ) {
      return Response.json({ error: 'Invalid timeline document' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error instanceof Error && error.name === 'TimelineVersionConflict') {
      return Response.json({ error: 'Timeline version conflict' }, { status: 409 });
    }
    console.error('save project timeline failed:', error);
    return Response.json({ error: 'Failed to save timeline' }, { status: 500 });
  }
}

async function POST({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const trust = validateTrustedWorkspaceJsonMutation(request);
  if (!trust.ok) {
    return Response.json({ error: trust.message }, { status: trust.status });
  }
  try {
    let referenceCardIds: string[] | undefined;
    try {
      const body = await readRequestTextWithLimit(
        request,
        MAX_TIMELINE_DOCUMENT_BYTES
      );
      if (body.trim()) {
        const payload = JSON.parse(body) as { referenceCardIds?: string[] };
        if (Array.isArray(payload.referenceCardIds)) {
          referenceCardIds = payload.referenceCardIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0
          );
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
      }
      throw error;
    }
    const timeline = await loadProjectTimeline(params.projectId);
    if (!timeline) {
      return Response.json({ error: 'Timeline not found' }, { status: 404 });
    }
    const clipCount = timeline.document.tracks.reduce(
      (count, track) => count + track.clips.length,
      0
    );
    const commandId = createCommandId();
    const command = {
      type: 'canvas.apply' as const,
      operations: [
        {
          type: 'upsert_timeline_node' as const,
          timelineId: timeline.document.id,
          name: timeline.document.name,
          durationSec: timeline.document.duration,
          clipCount,
          lastRenderAssetId: timeline.document.lastRenderAssetId,
          lastRenderUrl: timeline.document.lastRenderUrl,
          referenceCardIds,
        },
      ],
    };
    let result = await persistBeatDesignCommand({
      projectId: params.projectId,
      origin: 'ui',
      commandId,
      idempotencyKey: commandId,
      command,
    });
    if (!result.ok && result.code === 'REVISION_CONFLICT') {
      result = await persistBeatDesignCommand({
        projectId: params.projectId,
        origin: 'ui',
        commandId,
        idempotencyKey: commandId,
        command,
      });
    }
    if (!result.ok) {
      return Response.json(
        { error: result.message },
        {
          status:
            result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'REVISION_CONFLICT'
                ? 409
                : 400,
        }
      );
    }
    return Response.json({
      timelineNode: {
        cardId: result.changedIds[0],
        version: result.revision,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Timeline not found') {
      return Response.json({ error: 'Timeline not found' }, { status: 404 });
    }
    console.error('add timeline canvas node failed:', error);
    return Response.json({ error: 'Failed to add timeline to Canvas' }, { status: 500 });
  }
}

export const Route = createFileRoute(
  '/api/app/projects/$projectId/timeline'
)({
  server: { handlers: { GET, PUT, POST } },
});
