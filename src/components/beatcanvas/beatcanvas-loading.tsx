import { useTranslations } from '@/core/workspace-lib/shims/next-intl';

export function BeatCanvasLoading() {
  const t = useTranslations('Common');

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[var(--beatcanvas-canvas-bg)]">
      <div className="flex flex-1 items-center justify-center px-6">
        <output
          aria-live="polite"
          className="animate-pulse text-[13px] font-medium tracking-[0.18em] text-[var(--beatcanvas-ink-faint)]"
        >
          {t('loading')}
        </output>
      </div>
    </div>
  );
}
