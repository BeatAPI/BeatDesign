import {
  loadProjectTimeline,
  saveProjectTimeline,
} from '@/core/editor/timeline-state';
import {
  loadProjectWithLatestSnapshot,
  saveProjectSnapshot,
} from '@/core/projects/projects';

import { normalizeCommandAssetReferences } from './asset-boundary';
import { timelineCanvasCardId } from './canvas-commands';
import {
  BeatDesignCommandError,
  createCommandFailure,
  createCommandId,
  type BeatDesignCommandEnvelope,
  type BeatDesignCommandOrigin,
  type BeatDesignCommandResult,
} from './contracts';
import {
  executeBeatDesignCommand,
  type BeatDesignCommand,
  type BeatDesignCommandData,
} from './executor';
import {
  loadCommandReceipt,
  loadCommandReceiptRecord,
  storeCommandReceipt,
} from './receipts';

const inFlightCommands = new Map<
  string,
  {
    commandId: string;
    commandType: BeatDesignCommand['type'];
    promise: Promise<BeatDesignCommandResult<BeatDesignCommandData>>;
  }
>();

const isVersionConflict = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'TimelineVersionConflict' ||
    error.name === 'ProjectSnapshotVersionConflict');

const getConflictRevision = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined;
  const currentVersion = (error as { currentVersion?: unknown }).currentVersion;
  return typeof currentVersion === 'number' && Number.isFinite(currentVersion)
    ? currentVersion
    : undefined;
};

type PersistCommandInput = {
  projectId: string;
  origin: BeatDesignCommandOrigin;
  commandId: string;
  expectedRevision?: number | null;
  idempotencyKey: string;
  command: BeatDesignCommand;
};

const timelineClipCount = (document: NonNullable<BeatDesignCommandData['timeline']>) =>
  document.tracks.reduce((count, track) => count + track.clips.length, 0);

async function syncExistingTimelineCanvasCard({
  projectId,
  timeline,
}: {
  projectId: string;
  timeline: NonNullable<BeatDesignCommandData['timeline']>;
}) {
  const cardId = timelineCanvasCardId(timeline.id);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await loadProjectWithLatestSnapshot({ projectId });
    if (!state || !state.snapshot.cards.some((card) => card.id === cardId)) return null;
    const commandId = createCommandId();
    const envelope: BeatDesignCommandEnvelope<BeatDesignCommand> = {
      commandId,
      projectId,
      origin: 'system',
      expectedRevision: state.snapshotVersion,
      idempotencyKey: commandId,
      command: {
        type: 'canvas.apply',
        operations: [
          {
            type: 'upsert_timeline_node',
            timelineId: timeline.id,
            name: timeline.name,
            durationSec: timeline.duration,
            clipCount: timelineClipCount(timeline),
            lastRenderAssetId: timeline.lastRenderAssetId,
            lastRenderUrl: timeline.lastRenderUrl,
          },
        ],
      },
    };
    const executed = executeBeatDesignCommand({
      envelope,
      documents: { canvas: state.snapshot },
    });
    if (!executed.ok || !executed.data.canvas) {
      return executed.ok ? 'Canvas timeline node could not be synchronized.' : executed.message;
    }
    try {
      await saveProjectSnapshot({
        projectId,
        document: executed.data.canvas,
        baseVersion: state.snapshotVersion,
      });
      return null;
    } catch (error) {
      if (!isVersionConflict(error) || attempt === 2) {
        return error instanceof Error
          ? error.message
          : 'Canvas timeline node could not be synchronized.';
      }
    }
  }
  return 'Canvas timeline node could not be synchronized.';
}

export function validateExternalCommandAssetReferences({
  origin,
  command,
}: {
  origin: BeatDesignCommandOrigin;
  command: BeatDesignCommand;
}) {
  if (origin !== 'mcp' && origin !== 'cli') return;
  if (command.type !== 'canvas.apply') return;

  for (const operation of command.operations) {
    if (operation.type === 'upsert_card') {
      const { card } = operation;
      if (
        card.kind === 'asset' &&
        card.type !== 'timeline' &&
        !card.assetId
      ) {
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'External Canvas asset cards require a project assetId. Import or generate the asset first.'
        );
      }
      if (card.url && !card.assetId) {
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'External Canvas media URLs must be derived from a project assetId.'
        );
      }
    }

    if (
      operation.type === 'upsert_timeline_node' &&
      operation.lastRenderUrl &&
      !operation.lastRenderAssetId
    ) {
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'External timeline renders require lastRenderAssetId; the server derives lastRenderUrl.'
      );
    }
  }
}

async function persistBeatDesignCommandOnce({
  projectId,
  origin,
  commandId,
  expectedRevision,
  idempotencyKey,
  command,
}: PersistCommandInput): Promise<
  BeatDesignCommandResult<BeatDesignCommandData>
> {
  const cached = await loadCommandReceiptRecord({ projectId, idempotencyKey });
  if (cached) {
    if (
      cached.commandId !== commandId ||
      cached.commandType !== command.type
    ) {
      return createCommandFailure({
        commandId,
        projectId,
        origin,
        code: 'INVALID_COMMAND',
        message: 'Idempotency key is already bound to a different command.',
      });
    }
    return cached.result;
  }

  if (
    command.type === 'editor.replace_document' &&
    origin !== 'ui' &&
    origin !== 'system'
  ) {
    return createCommandFailure({
      commandId,
      projectId,
      origin,
      code: 'INVALID_COMMAND',
      message:
        'External agents must use editor.apply operations instead of replacing the timeline document.',
    });
  }

  try {
    validateExternalCommandAssetReferences({ origin, command });
    const normalizedCommand = await normalizeCommandAssetReferences({
      projectId,
      command,
    });
    const envelope: BeatDesignCommandEnvelope<BeatDesignCommand> = {
      commandId,
      projectId,
      origin,
      expectedRevision,
      idempotencyKey,
      command: normalizedCommand,
    };

    let result: BeatDesignCommandResult<BeatDesignCommandData>;
    if (normalizedCommand.type === 'canvas.apply') {
      const state = await loadProjectWithLatestSnapshot({ projectId });
      if (!state) {
        return createCommandFailure({
          commandId,
          projectId,
          origin,
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      const executed = executeBeatDesignCommand({
        envelope,
        documents: { canvas: state.snapshot },
      });
      if (!executed.ok || !executed.data.canvas) return executed;
      const saved = await saveProjectSnapshot({
        projectId,
        document: executed.data.canvas,
        baseVersion:
          typeof expectedRevision === 'number'
            ? expectedRevision
            : state.snapshotVersion,
      });
      result = { ...executed, revision: saved.version };
    } else {
      const timeline = await loadProjectTimeline(projectId);
      const executed = executeBeatDesignCommand({
        envelope,
        documents: { timeline: timeline?.document ?? null },
      });
      if (!executed.ok) return executed;
      if (normalizedCommand.type === 'editor.validate') {
        return { ...executed, revision: timeline?.version };
      }
      if (!executed.data.timeline) return executed;
      const saved = await saveProjectTimeline({
        projectId,
        document: executed.data.timeline,
        baseVersion:
          typeof expectedRevision === 'number'
            ? expectedRevision
            : (timeline?.version ?? null),
      });
      result = {
        ...executed,
        revision: saved.version,
        editorUrl: `/editor/${encodeURIComponent(projectId)}`,
        data: {
          ...executed.data,
          timeline: saved.document,
        },
      };
      const canvasSyncWarning = await syncExistingTimelineCanvasCard({
        projectId,
        timeline: saved.document,
      });
      if (canvasSyncWarning) {
        result = {
          ...result,
          warnings: [
            ...result.warnings,
            `Timeline saved, but its Canvas card is still synchronizing: ${canvasSyncWarning}`,
          ],
        };
      }
    }

    return storeCommandReceipt({
      projectId,
      idempotencyKey,
      commandId,
      origin,
      commandType: normalizedCommand.type,
      result,
    });
  } catch (error) {
    if (error instanceof BeatDesignCommandError) {
      return createCommandFailure({
        commandId,
        projectId,
        origin,
        code: error.code,
        message: error.message,
      });
    }
    if (isVersionConflict(error)) {
      const cached = await loadCommandReceipt({ projectId, idempotencyKey });
      if (cached) return cached;
      return createCommandFailure({
        commandId,
        projectId,
        origin,
        code: 'REVISION_CONFLICT',
        revision: getConflictRevision(error),
        message:
          command.type === 'canvas.apply'
            ? 'Project snapshot version conflict'
            : 'Timeline version conflict',
      });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return createCommandFailure({
        commandId,
        projectId,
        origin,
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    return createCommandFailure({
      commandId,
      projectId,
      origin,
      code: 'COMMAND_FAILED',
      message:
        error instanceof Error ? error.message : 'The command could not be saved.',
    });
  }
}

export function persistBeatDesignCommand({
  projectId,
  origin,
  commandId = createCommandId(),
  expectedRevision,
  idempotencyKey,
  command,
}: {
  projectId: string;
  origin: BeatDesignCommandOrigin;
  commandId?: string;
  expectedRevision?: number | null;
  idempotencyKey?: string | null;
  command: BeatDesignCommand;
}): Promise<BeatDesignCommandResult<BeatDesignCommandData>> {
  if (
    command.type === 'editor.replace_document' &&
    origin !== 'ui' &&
    origin !== 'system'
  ) {
    return Promise.resolve(
      createCommandFailure({
        commandId,
        projectId,
        origin,
        code: 'INVALID_COMMAND',
        message:
          'External agents must use editor.apply operations instead of replacing the timeline document.',
      })
    );
  }
  try {
    validateExternalCommandAssetReferences({ origin, command });
  } catch (error) {
    if (error instanceof BeatDesignCommandError) {
      return Promise.resolve(
        createCommandFailure({
          commandId,
          projectId,
          origin,
          code: error.code,
          message: error.message,
        })
      );
    }
    throw error;
  }
  const stableIdempotencyKey = idempotencyKey?.trim() || commandId;
  const lockKey = `${projectId}:${stableIdempotencyKey}`;
  const existing = inFlightCommands.get(lockKey);
  if (existing) {
    if (
      existing.commandId !== commandId ||
      existing.commandType !== command.type
    ) {
      return Promise.resolve(
        createCommandFailure({
          commandId,
          projectId,
          origin,
          code: 'INVALID_COMMAND',
          message: 'Idempotency key is already bound to a different command.',
        })
      );
    }
    return existing.promise;
  }

  const promise = persistBeatDesignCommandOnce({
    projectId,
    origin,
    commandId,
    expectedRevision,
    idempotencyKey: stableIdempotencyKey,
    command,
  }).finally(() => {
    if (inFlightCommands.get(lockKey)?.promise === promise) {
      inFlightCommands.delete(lockKey);
    }
  });
  inFlightCommands.set(lockKey, {
    commandId,
    commandType: command.type,
    promise,
  });
  return promise;
}
