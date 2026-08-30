import {
  normalizeTimelineDocument,
  type TimelineDocument,
} from './timeline-document';

export type TimelineMergeConflict = { path: string };

const equal = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isIdArray = (value: unknown[]): value is Array<Record<string, unknown>> =>
  value.every(
    (item) => isRecord(item) && typeof item.id === 'string' && item.id.length > 0
  );

function mergeValue({
  base,
  local,
  remote,
  path,
  conflicts,
}: {
  base: unknown;
  local: unknown;
  remote: unknown;
  path: string;
  conflicts: TimelineMergeConflict[];
}): unknown {
  if (equal(local, remote)) return local;
  if (equal(local, base)) return remote;
  if (equal(remote, base)) return local;

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (!isIdArray(base) || !isIdArray(local) || !isIdArray(remote)) {
      conflicts.push({ path });
      return local;
    }
    const baseMap = new Map(base.map((item) => [item.id as string, item]));
    const localMap = new Map(local.map((item) => [item.id as string, item]));
    const remoteMap = new Map(remote.map((item) => [item.id as string, item]));
    const ids = Array.from(
      new Set([
        ...remote.map((item) => item.id as string),
        ...local.map((item) => item.id as string),
        ...base.map((item) => item.id as string),
      ])
    );
    const merged: unknown[] = [];
    for (const id of ids) {
      const baseItem = baseMap.get(id);
      const localItem = localMap.get(id);
      const remoteItem = remoteMap.get(id);
      if (!localItem && !remoteItem) continue;
      if (!baseItem) {
        if (localItem && remoteItem && !equal(localItem, remoteItem)) {
          conflicts.push({ path: `${path}[${id}]` });
        }
        merged.push(localItem ?? remoteItem);
        continue;
      }
      if (!localItem) {
        if (!equal(remoteItem, baseItem)) {
          conflicts.push({ path: `${path}[${id}]` });
          merged.push(remoteItem);
        }
        continue;
      }
      if (!remoteItem) {
        if (!equal(localItem, baseItem)) {
          conflicts.push({ path: `${path}[${id}]` });
          merged.push(localItem);
        }
        continue;
      }
      merged.push(
        mergeValue({
          base: baseItem,
          local: localItem,
          remote: remoteItem,
          path: `${path}[${id}]`,
          conflicts,
        })
      );
    }
    return merged;
  }

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const merged: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ]);
    for (const key of keys) {
      if (key === 'updatedAt' || key === 'duration') continue;
      merged[key] = mergeValue({
        base: base[key],
        local: local[key],
        remote: remote[key],
        path: `${path}.${key}`,
        conflicts,
      });
    }
    if ('updatedAt' in local) merged.updatedAt = local.updatedAt;
    if ('duration' in local) merged.duration = local.duration;
    return merged;
  }

  conflicts.push({ path });
  return local;
}

export function mergeTimelineDocuments({
  base,
  local,
  remote,
}: {
  base: TimelineDocument;
  local: TimelineDocument;
  remote: TimelineDocument;
}) {
  const conflicts: TimelineMergeConflict[] = [];
  const merged = mergeValue({
    base,
    local,
    remote,
    path: 'timeline',
    conflicts,
  });
  return {
    document: normalizeTimelineDocument(merged, local.projectId),
    conflicts,
  };
}
