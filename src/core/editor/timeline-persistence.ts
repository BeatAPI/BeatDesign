import type { TimelineDocument } from './timeline-document';
import { executeProjectCommand } from '@/core/commands/client';
import { createCommandId } from '@/core/commands/contracts';
import { buildTimelineEditCommand } from './timeline-command';

export function shouldPersistTimelineDocument({
  isHydrated,
  document,
  lastSavedDocument,
}: {
  isHydrated: boolean;
  document: TimelineDocument;
  lastSavedDocument: TimelineDocument | null;
}) {
  return (
    isHydrated &&
    (!lastSavedDocument ||
      !timelineDocumentsEqualForPersistence(document, lastSavedDocument))
  );
}

export function timelineDocumentsEqualForPersistence(
  left: TimelineDocument,
  right: TimelineDocument
) {
  const { updatedAt: _leftUpdatedAt, ...leftContent } = left;
  const { updatedAt: _rightUpdatedAt, ...rightContent } = right;
  return JSON.stringify(leftContent) === JSON.stringify(rightContent);
}

export const saveTimelineThroughCommand = async ({
  projectId,
  document,
  expectedRevision,
  commandId = createCommandId(),
  baseDocument = null,
  keepalive = false,
}: {
  projectId: string;
  document: TimelineDocument;
  expectedRevision: number | null;
  commandId?: string;
  baseDocument?: TimelineDocument | null;
  keepalive?: boolean;
}) => {
  const result = await executeProjectCommand({
    projectId,
    commandId,
    idempotencyKey: commandId,
    expectedRevision,
    keepalive,
    command: buildTimelineEditCommand(baseDocument, document),
  });
  if (!result.ok) {
    const error = new Error(result.message) as Error & { code?: string };
    error.code = result.code;
    throw error;
  }
  if (!result.data.timeline || typeof result.revision !== 'number') {
    throw new Error('Timeline command returned no saved document.');
  }
  return { document: result.data.timeline, version: result.revision };
};
