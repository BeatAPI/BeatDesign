import {
  normalizeProjectSnapshotDocument,
  type ProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import type { CanvasCardMediaType } from '@/core/beatcanvas/canvas-types';
import { buildCanvasOperations } from '@/core/commands/canvas-diff';
import { executeProjectCommand } from '@/core/commands/client';
import { createCommandId } from '@/core/commands/contracts';
import { hasNewProjectRevision } from '@/core/projects/revision-client';
import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from '@/lib/trusted-local-request';
import { useCallback, useEffect, useRef, useState } from 'react';

export const PROJECT_SNAPSHOT_AUTOSAVE_DELAY_MS = 350;
export const PROJECT_SNAPSHOT_CHECKPOINT_INTERVAL_MS = 5_000;
export const PROJECT_SNAPSHOT_EXTERNAL_POLL_INTERVAL_MS = 2_000;

export const buildProjectSnapshotRequestHeaders = () => ({
  'content-type': 'application/json',
  [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE,
});

const hasHydratableProjectSnapshot = (
  snapshot: ProjectSnapshotDocument | null
): snapshot is ProjectSnapshotDocument =>
  Boolean(
    snapshot && (snapshot.cards.length > 0 || snapshot.workflows?.activeTemplate)
  );

const valuesEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeThreeWayValue = (
  base: unknown,
  local: unknown,
  remote: unknown,
  key?: string,
  strict = false
): unknown => {
  if (valuesEqual(local, base)) return remote;
  if (valuesEqual(remote, base) || valuesEqual(local, remote)) return local;
  if (local === undefined || remote === undefined) {
    if (strict) throw new Error('Canvas deletion conflicts with an edit.');
    return local ?? remote;
  }

  if (!strict &&
    key === 'referenceCardIds' &&
    Array.isArray(local) &&
    Array.isArray(remote)
  ) {
    return Array.from(
      new Set(
        [...remote, ...local].filter(
          (value): value is string => typeof value === 'string'
        )
      )
    );
  }

  if (isRecord(local) && isRecord(remote)) {
    const baseRecord = isRecord(base) ? base : {};
    return Array.from(
      new Set([
        ...Object.keys(baseRecord),
        ...Object.keys(remote),
        ...Object.keys(local),
      ])
    ).reduce<Record<string, unknown>>((merged, childKey) => {
      const value = mergeThreeWayValue(
        baseRecord[childKey],
        local[childKey],
        remote[childKey],
        childKey,
        strict
      );
      if (value !== undefined) merged[childKey] = value;
      return merged;
    }, {});
  }

  if (strict) throw new Error(`Canvas edit conflict at ${key ?? 'card'}.`);
  return local;
};

export const mergeProjectSnapshotsAfterConflict = ({
  base,
  local,
  remote,
}: {
  base: ProjectSnapshotDocument | null;
  local: ProjectSnapshotDocument;
  remote: ProjectSnapshotDocument;
}): ProjectSnapshotDocument => {
  const empty = normalizeProjectSnapshotDocument({ cards: [], frames: {} });
  const baseDocument = base ?? empty;
  const baseCards = new Map(baseDocument.cards.map((card) => [card.id, card]));
  const localCards = new Map(local.cards.map((card) => [card.id, card]));
  const remoteCards = new Map(remote.cards.map((card) => [card.id, card]));
  const cardIds = Array.from(
    new Set([...baseCards.keys(), ...remoteCards.keys(), ...localCards.keys()])
  ).sort();
  const cards = cardIds.flatMap((cardId) => {
    const merged = mergeThreeWayValue(
      baseCards.get(cardId),
      localCards.get(cardId),
      remoteCards.get(cardId),
      cardId,
      true
    );
    return isRecord(merged) ? [merged] : [];
  });

  return normalizeProjectSnapshotDocument({
    version: 3,
    cards,
    frames: mergeThreeWayValue(
      baseDocument.frames,
      local.frames,
      remote.frames
    ),
    camera: mergeThreeWayValue(
      baseDocument.camera,
      local.camera,
      remote.camera
    ),
    workflows: mergeThreeWayValue(
      baseDocument.workflows,
      local.workflows,
      remote.workflows
    ),
  });
};

export function buildProjectPathWithoutEntryIntentSearch({
  projectPath,
  search,
}: {
  projectPath: string;
  search: string;
}) {
  const searchParams = new URLSearchParams(search);
  searchParams.delete('prompt');
  searchParams.delete('template');
  const nextQuery = searchParams.toString();
  return nextQuery ? `${projectPath}?${nextQuery}` : projectPath;
}

export function useProjectSnapshotLifecycle({
  projectId,
  projectPath,
  initialProjectSnapshot,
  initialProjectSnapshotVersion,
  initialPrompt,
  initialTaskType,
  isCanvasReady,
  snapshotChangeSignal,
  allowEmptyProjectSnapshot,
  buildProjectSnapshotDocument,
  restoreProjectSnapshot,
  createDraftCard,
  onEmptyProjectSnapshotSaved,
  onProjectSnapshotConflict,
}: {
  projectId: string;
  projectPath: string;
  initialProjectSnapshot: ProjectSnapshotDocument | null;
  initialProjectSnapshotVersion: number | null;
  initialPrompt: string | null;
  initialTaskType: CanvasCardMediaType;
  isCanvasReady: boolean;
  snapshotChangeSignal: unknown;
  allowEmptyProjectSnapshot: boolean;
  buildProjectSnapshotDocument: () => ProjectSnapshotDocument;
  restoreProjectSnapshot: (document: ProjectSnapshotDocument) => void;
  createDraftCard: (input: {
    taskType: CanvasCardMediaType;
    prompt: string;
    referenceCardIds: string[];
  }) => string | null;
  onEmptyProjectSnapshotSaved?: () => void;
  onProjectSnapshotConflict?: () => void;
}) {
  const [isHydratedFromProject, setIsHydratedFromProject] = useState(false);
  const [isHydratedFromQuery, setIsHydratedFromQuery] = useState(false);
  const lastSavedProjectSnapshotRef = useRef<string | null>(
    initialProjectSnapshot ? JSON.stringify(initialProjectSnapshot) : null
  );
  const pendingProjectSnapshotRef = useRef<string | null>(null);
  const lastSavedProjectSnapshotVersionRef = useRef<number | null>(
    initialProjectSnapshotVersion
  );
  const saveQueueRef = useRef(Promise.resolve());
  const externalPollInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const buildSnapshotRef = useRef(buildProjectSnapshotDocument);
  buildSnapshotRef.current = buildProjectSnapshotDocument;

  const saveSerializedSnapshot = useCallback(
    async (serializedSnapshot: string, allowEmpty: boolean) => {
      const runSave = async () => {
        const targetSerializedSnapshot =
          pendingProjectSnapshotRef.current ?? serializedSnapshot;
        if (targetSerializedSnapshot === lastSavedProjectSnapshotRef.current) {
          if (
            pendingProjectSnapshotRef.current === targetSerializedSnapshot
          ) {
            pendingProjectSnapshotRef.current = null;
          }
          return;
        }

        const localSnapshotDocument = JSON.parse(
          targetSerializedSnapshot
        ) as ProjectSnapshotDocument;
        const baseSnapshotDocument = lastSavedProjectSnapshotRef.current
          ? (JSON.parse(
              lastSavedProjectSnapshotRef.current
            ) as ProjectSnapshotDocument)
          : null;

        let snapshotToSave = localSnapshotDocument;
        let commandBase = baseSnapshotDocument;
        const sendSaveRequest = async (baseVersion: number | null) => {
          const operations = buildCanvasOperations(commandBase, snapshotToSave, allowEmpty);
          if (!operations.length) return null;
          return executeProjectCommand({
            projectId,
            expectedRevision: baseVersion,
            command: { type: 'canvas.apply', operations },
          });
        };

        let recoveredFromConflict = false;
        let result = await sendSaveRequest(lastSavedProjectSnapshotVersionRef.current);
        if (result && !result.ok && result.code === 'REVISION_CONFLICT') {
          const latestResponse = await fetch(
            `/api/app/projects/${encodeURIComponent(projectId)}/snapshot`
          );
          if (!latestResponse.ok) throw new Error(result.message);
          const latest = await latestResponse.json() as {
            version: number; document: ProjectSnapshotDocument;
          };
          snapshotToSave = mergeProjectSnapshotsAfterConflict({
            base: baseSnapshotDocument,
            local: localSnapshotDocument,
            remote: latest.document,
          });
          commandBase = latest.document;
          lastSavedProjectSnapshotVersionRef.current = latest.version;
          result = await sendSaveRequest(latest.version);
          recoveredFromConflict = true;
        }
        if (result && !result.ok) {
          onProjectSnapshotConflict?.();
          throw new Error(result.message);
        }
        if (result?.ok) {
          lastSavedProjectSnapshotVersionRef.current = result.revision ?? null;
          snapshotToSave = result.data.canvas ?? snapshotToSave;
        }
        const savedSerializedSnapshot = JSON.stringify(snapshotToSave);
        lastSavedProjectSnapshotRef.current = savedSerializedSnapshot;

        const newestPendingSnapshot = pendingProjectSnapshotRef.current;
        let restoredRebasedSnapshot = false;
        if (
          recoveredFromConflict &&
          newestPendingSnapshot &&
          newestPendingSnapshot !== targetSerializedSnapshot
        ) {
          const rebasedLocalSnapshot = mergeProjectSnapshotsAfterConflict({
            base: localSnapshotDocument,
            local: JSON.parse(newestPendingSnapshot) as ProjectSnapshotDocument,
            remote: snapshotToSave,
          });
          pendingProjectSnapshotRef.current = JSON.stringify(
            rebasedLocalSnapshot
          );
          restoreProjectSnapshot(rebasedLocalSnapshot);
          restoredRebasedSnapshot = true;
        } else if (
          pendingProjectSnapshotRef.current === targetSerializedSnapshot
        ) {
          pendingProjectSnapshotRef.current = null;
        }
        if (recoveredFromConflict && !restoredRebasedSnapshot) {
          restoreProjectSnapshot(snapshotToSave);
        }
        if (allowEmpty && snapshotToSave.cards.length === 0) {
          onEmptyProjectSnapshotSaved?.();
        }
      };

      const guardedSave = async () => {
        saveInFlightRef.current = true;
        try { await runSave(); }
        catch (error) { onProjectSnapshotConflict?.(); throw error; }
        finally { saveInFlightRef.current = false; }
      };
      const queuedSave = saveQueueRef.current.then(guardedSave, guardedSave);
      saveQueueRef.current = queuedSave.catch(() => {});
      await queuedSave;
    },
    [
      onEmptyProjectSnapshotSaved,
      onProjectSnapshotConflict,
      projectId,
      restoreProjectSnapshot,
    ]
  );

  useEffect(() => {
    if (!initialPrompt?.trim()) return;

    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has('prompt')) return;

    window.history.replaceState(
      window.history.state,
      '',
      buildProjectPathWithoutEntryIntentSearch({
        projectPath,
        search: window.location.search,
      })
    );
  }, [initialPrompt, projectPath]);

  useEffect(() => {
    if (!isCanvasReady || isHydratedFromProject) return;

    if (hasHydratableProjectSnapshot(initialProjectSnapshot)) {
      restoreProjectSnapshot(initialProjectSnapshot);
    }

    setIsHydratedFromProject(true);
  }, [
    initialProjectSnapshot,
    isCanvasReady,
    isHydratedFromProject,
    restoreProjectSnapshot,
  ]);

  useEffect(() => {
    if (!isCanvasReady || !isHydratedFromProject || isHydratedFromQuery) return;

    if (initialPrompt?.trim()) {
      createDraftCard({
        taskType: initialTaskType,
        prompt: initialPrompt.trim(),
        referenceCardIds: [],
      });
    }

    setIsHydratedFromQuery(true);
  }, [
    createDraftCard,
    initialPrompt,
    initialTaskType,
    isCanvasReady,
    isHydratedFromProject,
    isHydratedFromQuery,
  ]);

  useEffect(() => {
    if (!isCanvasReady || !isHydratedFromProject) return;

    const serializedSnapshot = JSON.stringify(buildProjectSnapshotDocument());
    if (serializedSnapshot === lastSavedProjectSnapshotRef.current) {
      return;
    }
    pendingProjectSnapshotRef.current = serializedSnapshot;

    const timeoutId = window.setTimeout(async () => {
      try {
        await saveSerializedSnapshot(
          serializedSnapshot,
          allowEmptyProjectSnapshot
        );
      } catch (error) {
        console.error('save project snapshot failed:', error);
      }
    }, PROJECT_SNAPSHOT_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    buildProjectSnapshotDocument,
    allowEmptyProjectSnapshot,
    isCanvasReady,
    isHydratedFromProject,
    saveSerializedSnapshot,
    snapshotChangeSignal,
  ]);

  useEffect(() => {
    if (!isCanvasReady || !isHydratedFromProject) return;

    const checkpointSnapshot = async () => {
      const serializedSnapshot = JSON.stringify(buildProjectSnapshotDocument());
      if (serializedSnapshot === lastSavedProjectSnapshotRef.current) {
        return;
      }

      pendingProjectSnapshotRef.current = serializedSnapshot;
      try {
        await saveSerializedSnapshot(
          serializedSnapshot,
          allowEmptyProjectSnapshot
        );
      } catch (error) {
        console.error('checkpoint project snapshot failed:', error);
      }
    };

    const intervalId = window.setInterval(() => {
      void checkpointSnapshot();
    }, PROJECT_SNAPSHOT_CHECKPOINT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    allowEmptyProjectSnapshot,
    buildProjectSnapshotDocument,
    isCanvasReady,
    isHydratedFromProject,
    saveSerializedSnapshot,
  ]);

  useEffect(() => {
    if (!isCanvasReady || !isHydratedFromProject) return;
    const pollExternalSnapshot = async () => {
      if (document.visibilityState === 'hidden') return;
      if (saveInFlightRef.current) return;
      if (externalPollInFlightRef.current) return;
      externalPollInFlightRef.current = true;
      try {
        if (!await hasNewProjectRevision(projectId, 'canvas', lastSavedProjectSnapshotVersionRef.current)) return;
        const response = await fetch(
          `/api/app/projects/${encodeURIComponent(projectId)}/snapshot`
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          version?: number;
          document?: ProjectSnapshotDocument;
        };
        if (saveInFlightRef.current) return;
        if (
          typeof payload.version !== 'number' ||
          !payload.document ||
          payload.version <= (lastSavedProjectSnapshotVersionRef.current ?? 0)
        ) {
          return;
        }

        const baseSnapshot = lastSavedProjectSnapshotRef.current
          ? (JSON.parse(
              lastSavedProjectSnapshotRef.current
            ) as ProjectSnapshotDocument)
          : null;
        // Drag gestures can change layout before the autosave signal fires.
        const currentSnapshot = buildSnapshotRef.current();
        const pendingSnapshot = JSON.stringify(currentSnapshot) !== lastSavedProjectSnapshotRef.current
          ? currentSnapshot
          : null;
        const snapshotToRestore = pendingSnapshot
          ? mergeProjectSnapshotsAfterConflict({
              base: baseSnapshot,
              local: pendingSnapshot,
              remote: payload.document,
            })
          : payload.document;

        lastSavedProjectSnapshotVersionRef.current = payload.version;
        lastSavedProjectSnapshotRef.current = JSON.stringify(payload.document);
        pendingProjectSnapshotRef.current = pendingSnapshot
          ? JSON.stringify(snapshotToRestore)
          : null;
        restoreProjectSnapshot(snapshotToRestore);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Canvas ')) onProjectSnapshotConflict?.();
        // External refresh is best-effort; the next poll retries automatically.
      } finally {
        externalPollInFlightRef.current = false;
      }
    };

    const pollWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void pollExternalSnapshot();
      }
    };

    void pollExternalSnapshot();
    const intervalId = window.setInterval(
      () => void pollExternalSnapshot(),
      PROJECT_SNAPSHOT_EXTERNAL_POLL_INTERVAL_MS
    );
    window.addEventListener('focus', pollWhenVisible);
    document.addEventListener('visibilitychange', pollWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', pollWhenVisible);
      document.removeEventListener('visibilitychange', pollWhenVisible);
    };
  }, [isCanvasReady, isHydratedFromProject, projectId, restoreProjectSnapshot]);

  useEffect(() => {
    if (!isCanvasReady || !isHydratedFromProject) return;

    const flushPendingSnapshot = () => {
      const serializedSnapshot =
        pendingProjectSnapshotRef.current ??
        JSON.stringify(buildProjectSnapshotDocument());

      if (serializedSnapshot === lastSavedProjectSnapshotRef.current) {
        return;
      }

      try {
        const operations = buildCanvasOperations(
          lastSavedProjectSnapshotRef.current ? JSON.parse(lastSavedProjectSnapshotRef.current) : null,
          JSON.parse(serializedSnapshot),
          allowEmptyProjectSnapshot
        );
        if (!operations.length) return;
        const commandId = createCommandId();
        void fetch(`/api/app/projects/${encodeURIComponent(projectId)}/commands`, {
          method: 'POST',
          headers: buildProjectSnapshotRequestHeaders(),
          body: JSON.stringify({
            commandId,
            idempotencyKey: commandId,
            expectedRevision: lastSavedProjectSnapshotVersionRef.current,
            command: { type: 'canvas.apply', operations },
          }),
          keepalive: true,
        }).catch(() => onProjectSnapshotConflict?.());
        pendingProjectSnapshotRef.current = serializedSnapshot;
      } catch (error) {
        console.error('flush project snapshot failed:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSnapshot();
      }
    };

    window.addEventListener('pagehide', flushPendingSnapshot);
    window.addEventListener('beforeunload', flushPendingSnapshot);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushPendingSnapshot);
      window.removeEventListener('beforeunload', flushPendingSnapshot);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    buildProjectSnapshotDocument,
    allowEmptyProjectSnapshot,
    isCanvasReady,
    isHydratedFromProject,
    projectId,
  ]);
}
