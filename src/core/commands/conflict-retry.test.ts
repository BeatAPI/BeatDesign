import assert from 'node:assert/strict';
import test from 'node:test';

import type { BeatDesignCommandResult } from './contracts';
import { persistExternalCommandWithConflictRetry } from './conflict-retry';

const input = {
  projectId: 'project-1',
  origin: 'mcp' as const,
  commandId: 'command-1',
  idempotencyKey: 'operation-1',
  expectedRevision: 3,
  command: {
    type: 'canvas.apply' as const,
    operations: [
      {
        type: 'move_card' as const,
        cardId: 'card-1',
        frame: { x: 40, y: 60, w: 320, h: 180 },
      },
    ],
  },
};

test('external incremental commands recover from a stale revision', async () => {
  const revisions: Array<number | null | undefined> = [];
  const persist = async (request: typeof input) => {
    revisions.push(request.expectedRevision);
    if (revisions.length === 1) {
      return {
        ok: false as const,
        commandId: request.commandId,
        projectId: request.projectId,
        origin: request.origin,
        changedIds: [] as [],
        warnings: [],
        code: 'REVISION_CONFLICT' as const,
        message: 'Project snapshot version conflict',
        revision: 4,
      };
    }
    return {
      ok: true as const,
      commandId: request.commandId,
      projectId: request.projectId,
      origin: request.origin,
      changedIds: ['card-1'],
      warnings: [],
      revision: 5,
      data: { canvas: {} },
    };
  };

  const result = await persistExternalCommandWithConflictRetry({
    input,
    persist: persist as never,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(revisions, [3, 4]);
  assert.deepEqual(result.conflictRecovery, {
    recovered: true,
    attempts: 2,
    initialExpectedRevision: 3,
    latestRevision: 5,
  });
});

test('persistent conflicts return an actionable latest revision', async () => {
  let revision = 3;
  const persist = async (request: typeof input) => {
    revision += 1;
    return {
      ok: false as const,
      commandId: request.commandId,
      projectId: request.projectId,
      origin: request.origin,
      changedIds: [] as [],
      warnings: [],
      code: 'REVISION_CONFLICT' as const,
      message: 'Project snapshot version conflict',
      revision,
    } satisfies BeatDesignCommandResult<never>;
  };

  const result = await persistExternalCommandWithConflictRetry({
    input,
    persist: persist as never,
  });

  assert.equal(result.ok, false);
  assert.equal(result.conflictRecovery?.attempts, 3);
  assert.equal(result.retry?.expectedRevision, 6);
  assert.match(result.retry?.instruction ?? '', /expectedRevision 6/);
});
