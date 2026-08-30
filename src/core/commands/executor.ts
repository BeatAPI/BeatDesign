import { diagnoseTimeline } from '@/core/editor/timeline-diagnostics';
import {
  createTimelineDocument,
  type TimelineDocument,
} from '@/core/editor/timeline-document';
import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';

import {
  applyCanvasOperations,
  type CanvasOperation,
} from './canvas-commands';
import {
  applyEditorOperations,
  type EditorOperation,
} from './editor-commands';
import {
  BeatDesignCommandError,
  createCommandFailure,
  createCommandSuccess,
  type BeatDesignCommandEnvelope,
  type BeatDesignCommandResult,
} from './contracts';

export type BeatDesignCommand =
  | { type: 'canvas.apply'; operations: CanvasOperation[] }
  | { type: 'editor.apply'; operations: EditorOperation[] }
  | { type: 'editor.replace_document'; document: TimelineDocument }
  | { type: 'editor.validate' };

export type BeatDesignCommandDocuments = {
  canvas?: ProjectSnapshotDocument;
  timeline?: TimelineDocument | null;
};

export type BeatDesignCommandData = BeatDesignCommandDocuments & {
  diagnostics?: ReturnType<typeof diagnoseTimeline>;
};

export function executeBeatDesignCommand({
  envelope,
  documents,
}: {
  envelope: BeatDesignCommandEnvelope<BeatDesignCommand>;
  documents: BeatDesignCommandDocuments;
}): BeatDesignCommandResult<BeatDesignCommandData> {
  const { commandId, projectId, origin, command } = envelope;

  try {
    if (command.type === 'canvas.apply') {
      if (!documents.canvas) {
        throw new BeatDesignCommandError(
          'NOT_FOUND',
          'Canvas document was not found.'
        );
      }
      const applied = applyCanvasOperations(documents.canvas, command.operations);
      return createCommandSuccess({
        commandId,
        projectId,
        origin,
        changedIds: applied.changedIds,
        data: { canvas: applied.document },
      });
    }

    if (command.type === 'editor.apply') {
      const source =
        documents.timeline ??
        createTimelineDocument({
          projectId,
          name: 'Timeline 1',
        });
      const applied = applyEditorOperations(source, command.operations);
      return createCommandSuccess({
        commandId,
        projectId,
        origin,
        changedIds: applied.changedIds,
        data: { timeline: applied.document },
      });
    }

    if (command.type === 'editor.replace_document') {
      return createCommandSuccess({
        commandId,
        projectId,
        origin,
        changedIds: [command.document.id],
        data: { timeline: command.document },
      });
    }

    if (!documents.timeline) {
      throw new BeatDesignCommandError(
        'NOT_FOUND',
        'Timeline document was not found.'
      );
    }
    return createCommandSuccess({
      commandId,
      projectId,
      origin,
      changedIds: [documents.timeline.id],
      data: {
        timeline: documents.timeline,
        diagnostics: diagnoseTimeline(documents.timeline),
      },
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
    return createCommandFailure({
      commandId,
      projectId,
      origin,
      code: 'COMMAND_FAILED',
      message:
        error instanceof Error ? error.message : 'The command could not be applied.',
    });
  }
}
