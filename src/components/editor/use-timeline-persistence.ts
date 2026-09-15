import { useEffect, useRef, type RefObject } from 'react';
import type { TimelineDocument } from '@/core/editor/timeline-document';
import { mergeTimelineDocuments } from '@/core/editor/timeline-merge';
import { saveTimelineThroughCommand, timelineDocumentsEqualForPersistence as equal } from '@/core/editor/timeline-persistence';
import { hasNewProjectRevision } from '@/core/projects/revision-client';
import { apiJsonGet } from '@/lib/api-client';

type TimelineState = { document: TimelineDocument; version: number };
type Options = {
  projectId: string;
  document: TimelineDocument;
  hydrated: boolean;
  documentRef: RefObject<TimelineDocument | null>;
  versionRef: RefObject<number | null>;
  savedRef: RefObject<TimelineDocument | null>;
  onDocument: (document: TimelineDocument) => void;
  onRemote: (document: TimelineDocument) => void;
  onStatus: (status: 'idle' | 'saving' | 'saved') => void;
  onError: (message: string) => void;
};

export function useTimelinePersistence(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const busy = useRef(false);
  const polling = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    const projectId = options.projectId;
    const load = () => apiJsonGet<{ timeline: TimelineState | null }>(
      `/api/app/projects/${encodeURIComponent(projectId)}/timeline`
    );
    const save = async (keepalive = false) => {
      const o = latest.current;
      const candidate = o.documentRef.current;
      const base = o.savedRef.current;
      if (!active || busy.current || !o.hydrated || !candidate || (base && equal(candidate, base))) return;
      busy.current = true;
      o.onStatus('saving');
      try {
        let saved: TimelineState;
        try {
          saved = await saveTimelineThroughCommand({ projectId, document: candidate, baseDocument: base, expectedRevision: o.versionRef.current, keepalive });
        } catch (error) {
          if ((error as { code?: string }).code !== 'REVISION_CONFLICT' || !base) throw error;
          const remote = (await load()).timeline;
          if (!remote) throw error;
          const merged = mergeTimelineDocuments({ base, local: candidate, remote: remote.document });
          if (merged.conflicts.length) throw new Error(`Timeline edit conflict at ${merged.conflicts[0].path}. Your local edit is still open.`);
          saved = await saveTimelineThroughCommand({ projectId, document: merged.document, baseDocument: remote.document, expectedRevision: remote.version });
        }
        if (!active) return;
        const current = o.documentRef.current ?? candidate;
        const rebased = equal(current, candidate) ? saved.document : mergeTimelineDocuments({ base: candidate, local: current, remote: saved.document }).document;
        o.versionRef.current = saved.version;
        o.savedRef.current = saved.document;
        o.documentRef.current = rebased;
        latest.current.onDocument(rebased);
        o.onStatus(equal(rebased, saved.document) ? 'saved' : 'saving');
      } catch (error) {
        if (active) {
          o.onStatus('idle');
          o.onError(error instanceof Error ? error.message : 'The timeline could not be saved.');
        }
      } finally {
        busy.current = false;
      }
    };
    saveRef.current = save;
    const poll = async () => {
      if (!active || globalThis.document.visibilityState === 'hidden' || busy.current || polling.current) return;
      const o = latest.current;
      if (!o.hydrated || !o.savedRef.current || !o.documentRef.current || !equal(o.savedRef.current, o.documentRef.current)) return;
      polling.current = true;
      try {
        if (!await hasNewProjectRevision(projectId, 'timeline', o.versionRef.current)) return;
        const remote = (await load()).timeline;
        if (!active || busy.current || !remote || (o.versionRef.current !== null && remote.version <= o.versionRef.current)) return;
        if (!o.documentRef.current || !o.savedRef.current || !equal(o.documentRef.current, o.savedRef.current)) return;
        o.versionRef.current = remote.version;
        o.savedRef.current = remote.document;
        o.documentRef.current = remote.document;
        latest.current.onRemote(remote.document);
      } finally {
        polling.current = false;
      }
    };
    const refresh = () => { void poll().catch(() => {}); };
    const flush = () => { void save(true); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const o = latest.current;
      if (o.hydrated && o.documentRef.current && (!o.savedRef.current || !equal(o.documentRef.current, o.savedRef.current))) {
        event.preventDefault();
        event.returnValue = '';
        flush();
      }
    };
    const visibility = () => globalThis.document.visibilityState === 'hidden' ? flush() : refresh();
    const timer = window.setInterval(refresh, 2_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', beforeUnload);
    globalThis.document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', beforeUnload);
      globalThis.document.removeEventListener('visibilitychange', visibility);
    };
  }, [options.projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void saveRef.current(); }, 700);
    return () => window.clearTimeout(timer);
  }, [options.document, options.hydrated, options.projectId]);
}
