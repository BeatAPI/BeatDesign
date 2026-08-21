'use client';

import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import type { CanvasCardMediaType } from '@/core/beatcanvas/canvas-types';
import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from '@/lib/trusted-local-request';
import { useCallback, useEffect, useRef, useState } from 'react';

type SnapshotSaveFailure = {
  message: string;
  currentVersion?: number;
};

export const PROJECT_SNAPSHOT_AUTOSAVE_DELAY_MS = 350;
export const PROJECT_SNAPSHOT_CHECKPOINT_INTERVAL_MS = 5_000;

const readSnapshotSaveFailure = async (
  response: Response
): Promise<SnapshotSaveFailure> => {
  const fallback = `Failed to save project snapshot (${response.status} ${response.statusText || 'Unknown error'})`;

  let rawPayload = '';
  try {
    rawPayload = await response.text();
  } catch {
    return { message: fallback };
  }

  if (!rawPayload.trim()) {
    return { message: fallback };
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      error?: string;
      detail?: string;
      currentVersion?: number;
    };
    const detail = [parsed.error, parsed.detail].filter(Boolean).join(': ');
    return {
      message: detail ? `${fallback}: ${detail}` : fallback,
      currentVersion:
        typeof parsed.currentVersion === 'number'
          ? parsed.currentVersion
          : undefined,
    };
  } catch {
    return { message: `${fallback}: ${rawPayload.trim().slice(0, 200)}` };
  }
};

const resolveSnapshotSaveErrorMessage = async (response: Response) =>
  (await readSnapshotSaveFailure(response)).message;

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

  const saveSerializedSnapshot = useCallback(
    async (serializedSnapshot: string, allowEmpty: boolean) => {
      const runSave = async () => {
        if (serializedSnapshot === lastSavedProjectSnapshotRef.current) {
          if (pendingProjectSnapshotRef.current === serializedSnapshot) {
            pendingProjectSnapshotRef.current = null;
          }
          return;
        }

        const snapshotDocument = JSON.parse(
          serializedSnapshot
        ) as ProjectSnapshotDocument;

        const sendSaveRequest = (baseVersion: number | null) =>
          fetch(`/api/app/projects/${projectId}/snapshot`, {
            method: 'PUT',
            headers: buildProjectSnapshotRequestHeaders(),
            body: JSON.stringify({
              document: snapshotDocument,
              baseVersion,
              allowEmpty,
            }),
          });

        let response = await sendSaveRequest(
          lastSavedProjectSnapshotVersionRef.current
        );

        if (response.status === 409) {
          const failure = await readSnapshotSaveFailure(response);
          if (typeof failure.currentVersion === 'number') {
            lastSavedProjectSnapshotVersionRef.current = failure.currentVersion;
            response = await sendSaveRequest(failure.currentVersion);
          } else {
            throw new Error(failure.message);
          }
        }

        if (!response.ok) {
          throw new Error(await resolveSnapshotSaveErrorMessage(response));
        }

        const result = (await response.json().catch(() => null)) as {
          version?: number;
        } | null;
        if (typeof result?.version === 'number') {
          lastSavedProjectSnapshotVersionRef.current = result.version;
        }
        lastSavedProjectSnapshotRef.current = serializedSnapshot;
        if (pendingProjectSnapshotRef.current === serializedSnapshot) {
          pendingProjectSnapshotRef.current = null;
        }
        if (allowEmpty && snapshotDocument.cards.length === 0) {
          onEmptyProjectSnapshotSaved?.();
        }
      };

      const queuedSave = saveQueueRef.current.then(runSave, runSave);
      saveQueueRef.current = queuedSave.catch(() => {});
      await queuedSave;
    },
    [onEmptyProjectSnapshotSaved, projectId]
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

    const flushPendingSnapshot = () => {
      const serializedSnapshot =
        pendingProjectSnapshotRef.current ??
        JSON.stringify(buildProjectSnapshotDocument());

      if (serializedSnapshot === lastSavedProjectSnapshotRef.current) {
        return;
      }

      try {
        void fetch(`/api/app/projects/${projectId}/snapshot`, {
          method: 'PUT',
          headers: buildProjectSnapshotRequestHeaders(),
          body: JSON.stringify({
            document: JSON.parse(serializedSnapshot) as ProjectSnapshotDocument,
            baseVersion: lastSavedProjectSnapshotVersionRef.current,
            allowEmpty: allowEmptyProjectSnapshot,
          }),
          keepalive: true,
        });
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
