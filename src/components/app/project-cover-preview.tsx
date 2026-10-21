import { useEffect, useState } from 'react';
import { FolderClock } from 'lucide-react';

/** Failed or unavailable video posters retain the same lightweight placeholder. */
export function ProjectCoverPreview({
  url,
  alt = '',
}: {
  url?: string | null;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <img
      src={url}
      alt={alt}
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <FolderClock
      aria-hidden="true"
      className="size-11 text-white/15"
      strokeWidth={1.15}
    />
  );
}
