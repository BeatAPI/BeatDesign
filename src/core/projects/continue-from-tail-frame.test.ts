import assert from 'node:assert/strict';
import test from 'node:test';

import {
  continueFromTailFrame,
  createTailContinuationIdentity,
} from './continue-from-tail-frame';

const state = {
  snapshotVersion: 4,
  snapshot: {
    cards: [
      {
        id: 'source-card',
        assetId: 'source-video',
        kind: 'asset',
        type: 'video',
        name: 'Source',
        aspectRatio: '16:9',
      },
    ],
    frames: {
      'source-card': { x: 10, y: 20, w: 360, h: 200 },
    },
  },
};

const frameAsset = {
  id: 'frame-stable',
  type: 'image' as const,
  publicUrl: '/frame.png',
  filename: 'frame.png',
  mimeType: 'image/png' as const,
  width: 160,
  height: 90,
  timeSeconds: 9.96,
  durationSeconds: 10,
  parentAssetId: 'source-video',
  reused: false,
};

test('tail continuation identities are stable and command-scoped', () => {
  const first = createTailContinuationIdentity({
    projectId: 'project-1',
    commandId: 'command-1',
  });
  assert.deepEqual(
    first,
    createTailContinuationIdentity({
      projectId: 'project-1',
      commandId: 'command-1',
    })
  );
  assert.notDeepEqual(
    first,
    createTailContinuationIdentity({
      projectId: 'project-1',
      commandId: 'command-2',
    })
  );
});

test('tail continuation rolls back a newly extracted frame after a final conflict', async () => {
  const removed: string[] = [];
  const result = await continueFromTailFrame(
    {
      projectId: 'project-1',
      sourceCardId: 'source-card',
      commandId: 'command-1',
    },
    {
      loadProjectState: async () => state as never,
      extractFrame: async () => frameAsset,
      removeFrame: async ({ assetId }) => {
        removed.push(assetId);
        return true;
      },
      persistCommand: (async () => ({
        ok: false,
        commandId: 'command-1',
        projectId: 'project-1',
        origin: 'mcp',
        changedIds: [],
        warnings: [],
        code: 'REVISION_CONFLICT',
        message: 'Project snapshot version conflict',
        revision: 7,
      })) as never,
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.frameAssetRolledBack, true);
  assert.deepEqual(removed, ['frame-stable']);
});

test('tail continuation returns a visible review target after a recovered write', async () => {
  const result = await continueFromTailFrame(
    {
      projectId: 'project-1',
      sourceCardId: 'source-card',
      commandId: 'command-1',
    },
    {
      loadProjectState: async () => state as never,
      extractFrame: async () => ({ ...frameAsset, reused: true }),
      removeFrame: async () => false,
      persistCommand: (async () => ({
        ok: true,
        commandId: 'command-1',
        projectId: 'project-1',
        origin: 'mcp',
        changedIds: ['frame-stable'],
        warnings: ['Recovered from a revision conflict after 2 attempts.'],
        revision: 6,
        data: { canvas: state.snapshot as never },
        conflictRecovery: {
          recovered: true,
          attempts: 2,
          initialExpectedRevision: 4,
          latestRevision: 6,
        },
      })) as never,
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.frameAsset.reused, true);
  assert.equal(result.review.tool, 'bdesign_canvas_view');
  assert.equal(result.review.cardId, result.generationCardId);
});

test('one command id cannot be reused with different generation settings', async () => {
  const identity = createTailContinuationIdentity({
    projectId: 'project-1',
    commandId: 'command-bound',
  });
  let extractionCount = 0;

  await assert.rejects(
    continueFromTailFrame(
      {
        projectId: 'project-1',
        sourceCardId: 'source-card',
        commandId: 'command-bound',
        prompt: 'A different prompt',
        modelId: 'seedance-2',
      },
      {
        loadProjectState: async () =>
          ({
            ...state,
            snapshot: {
              ...state.snapshot,
              cards: [
                ...state.snapshot.cards,
                {
                  id: identity.generationCardId,
                  kind: 'generation',
                  type: 'video',
                  prompt: 'The original prompt',
                  modelId: 'seedance-2',
                },
              ],
            },
          }) as never,
        extractFrame: async () => {
          extractionCount += 1;
          return frameAsset;
        },
        removeFrame: async () => false,
        persistCommand: (async () => {
          throw new Error('The command must be rejected before persistence.');
        }) as never,
      }
    ),
    /already bound to different generation settings/
  );

  assert.equal(extractionCount, 0);
});

test('concurrent retries with one command id share the same extraction', async () => {
  let extractionCount = 0;
  let releasePersist: (() => void) | undefined;
  const persistGate = new Promise<void>((resolve) => {
    releasePersist = resolve;
  });
  const dependencies = {
    loadProjectState: async () => state as never,
    extractFrame: async () => {
      extractionCount += 1;
      return frameAsset;
    },
    removeFrame: async () => false,
    persistCommand: (async () => {
      await persistGate;
      return {
        ok: true,
        commandId: 'command-concurrent',
        projectId: 'project-1',
        origin: 'mcp',
        changedIds: ['frame-stable'],
        warnings: [],
        revision: 5,
        data: { canvas: state.snapshot as never },
      };
    }) as never,
  };
  const input = {
    projectId: 'project-1',
    sourceCardId: 'source-card',
    commandId: 'command-concurrent',
  };

  const first = continueFromTailFrame(input, dependencies);
  const second = continueFromTailFrame(input, dependencies);
  releasePersist?.();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(extractionCount, 1);
  assert.deepEqual(firstResult, secondResult);
});
