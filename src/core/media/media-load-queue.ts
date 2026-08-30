const MAX_CONCURRENT_LOADS = 2;
const LOAD_TIMEOUT_MS = 15_000;

type QueueEntry = {
  element: HTMLMediaElement;
  src: string;
  cancelled: boolean;
};

const pending: QueueEntry[] = [];
let activeCount = 0;

const startNext = () => {
  while (activeCount < MAX_CONCURRENT_LOADS && pending.length > 0) {
    const entry = pending.shift();
    if (!entry || entry.cancelled) continue;

    activeCount += 1;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      entry.element.removeEventListener('loadedmetadata', finish);
      entry.element.removeEventListener('error', finish);
      activeCount -= 1;
      startNext();
    };
    const timeoutId = window.setTimeout(finish, LOAD_TIMEOUT_MS);
    entry.element.addEventListener('loadedmetadata', finish, { once: true });
    entry.element.addEventListener('error', finish, { once: true });

    if (
      entry.element.getAttribute('src') === entry.src &&
      entry.element.readyState >= 1
    ) {
      finish();
      continue;
    }
    entry.element.src = entry.src;
  }
};

export function enqueueMediaMetadataLoad(
  element: HTMLMediaElement,
  src: string
) {
  const entry: QueueEntry = { element, src, cancelled: false };
  if (!src) return () => undefined;
  pending.push(entry);
  startNext();
  return () => {
    entry.cancelled = true;
    const index = pending.indexOf(entry);
    if (index >= 0) pending.splice(index, 1);
  };
}
