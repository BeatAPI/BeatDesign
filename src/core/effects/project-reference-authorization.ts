import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';

export const resolveAuthorizedProjectReferenceUrls = ({
  referencedUrls,
  projectAssetUrls,
  snapshot,
}: {
  referencedUrls: string[];
  projectAssetUrls: string[];
  snapshot: ProjectSnapshotDocument | null | undefined;
}) => {
  const referenced = new Set(
    referencedUrls.map((url) => url.trim()).filter(Boolean)
  );
  const authorized = new Set<string>();

  for (const url of projectAssetUrls) {
    const normalizedUrl = url.trim();
    if (referenced.has(normalizedUrl)) {
      authorized.add(normalizedUrl);
    }
  }

  for (const card of snapshot?.cards ?? []) {
    const normalizedUrl = card.url?.trim();
    if (normalizedUrl && referenced.has(normalizedUrl)) {
      authorized.add(normalizedUrl);
    }
  }

  return [...authorized];
};
