import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';

export type BeatCanvasPreviewMedia = {
  type: 'image' | 'video';
  url: string;
  title: string;
};

type PreviewProps = {
  media: BeatCanvasPreviewMedia | null;
  closeLabel: string;
  onClose: () => void;
};

export function BeatCanvasMediaPreviewOverlay(props: PreviewProps) {
  if (!props.media) return null;
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <Dialog.Portal>
        <Dialog.Popup
          aria-label={props.media.title}
          className="pointer-events-auto fixed inset-x-0 bottom-0 top-14 z-[70] flex items-center justify-center bg-black/55 px-6 py-8 backdrop-blur-sm outline-none"
          onKeyDown={(event) => { if (event.key !== 'Escape') event.stopPropagation(); }}
        >
          <BeatCanvasMediaPreviewContent {...props} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function BeatCanvasMediaPreviewContent({ media, closeLabel, onClose }: PreviewProps) {
  if (!media) return null;
  return (
      <div className="relative flex max-w-[min(1120px,calc(100vw-48px))] flex-col items-center">
        <button
          type="button"
          aria-label={closeLabel}
          className={cn(
            'absolute -right-3 -top-3 z-10 inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border border-white/15 bg-black/75 px-2.5 text-[12px] font-semibold text-white shadow-lg transition hover:bg-black'
          )}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={2.2} />
          <span className="sr-only">{closeLabel}</span>
        </button>
        {media.type === 'video' ? (
          <video
            src={media.url}
            aria-label={media.title}
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            className="max-h-[calc(100vh-140px)] max-w-full rounded-[10px] bg-black object-contain shadow-2xl"
          />
        ) : (
          <img
            src={media.url}
            alt={media.title}
            className="max-h-[calc(100vh-140px)] max-w-full rounded-[10px] bg-white object-contain shadow-2xl"
            draggable={false}
          />
        )}
        <div className="mt-3 max-w-full truncate rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-medium text-white">
          {media.title}
        </div>
      </div>
  );
}
