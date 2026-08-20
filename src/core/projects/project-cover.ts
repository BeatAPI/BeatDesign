export type ProjectCoverCandidate = {
  projectId: string;
  type: string;
  publicUrl: string | null;
  createdAt: Date | null;
};

export function buildLatestProjectImageCoverMap(
  candidates: ProjectCoverCandidate[]
) {
  const coverMap = new Map<string, string>();
  const latestCreatedAtMap = new Map<string, number>();

  for (const candidate of candidates) {
    const normalizedUrl = candidate.publicUrl?.trim() ?? '';
    if (candidate.type !== 'image' || normalizedUrl.length === 0) {
      continue;
    }

    const createdAtMs = candidate.createdAt?.getTime() ?? 0;
    const previousCreatedAtMs =
      latestCreatedAtMap.get(candidate.projectId) ?? -1;

    if (createdAtMs >= previousCreatedAtMs) {
      latestCreatedAtMap.set(candidate.projectId, createdAtMs);
      coverMap.set(candidate.projectId, normalizedUrl);
    }
  }

  return coverMap;
}
