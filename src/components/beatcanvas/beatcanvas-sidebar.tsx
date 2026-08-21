'use client';

import type { RecentAsset } from '@/core/workspace-lib/app/workspace-client-api';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { Clock3, ImagePlus, Plus } from 'lucide-react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

type SidebarUploadIntent = 'image' | 'video' | 'media';
type ActivePanel = 'history';

const HistoryPanel = lazy(() =>
  import('./beatcanvas-sidebar-panels').then((mod) => ({
    default: mod.HistoryPanel,
  }))
);

export type BeatCanvasSidebarProps = {
  projectId?: string | null;
  onUploadMedia: () => void;
  onCreateImageDraft: () => void;
  onInsertHistoryAsset: (
    asset: RecentAsset & { mediaType: 'image' | 'video' }
  ) => void;
  uploadIntent: SidebarUploadIntent | null;
};

export default function BeatCanvasSidebar({
  projectId,
  onUploadMedia,
  onCreateImageDraft,
  onInsertHistoryAsset,
  uploadIntent,
}: BeatCanvasSidebarProps) {
  const t = useTranslations('AppShell.studio');
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);

  const handleTogglePanel = useCallback((panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleClosePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const handleCreateGenerationNode = useCallback(() => {
    setActivePanel(null);
    onCreateImageDraft();
  }, [onCreateImageDraft]);

  return (
    <>
      <div
        className="pointer-events-auto absolute left-4 top-[39%] z-50 flex w-[54px] -translate-y-1/2 flex-col items-center gap-1 rounded-[var(--beat-radius-sm)] border border-white/[0.13] bg-[var(--beatcanvas-panel)] px-1.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_24px_56px_rgba(0,0,0,0.48)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent"
      >
        <ToolBtn
          icon={<Plus size={18} />}
          title={t('toolbar.generationNode')}
          active={false}
          onClick={handleCreateGenerationNode}
        />
        <ToolBtn
          icon={<ImagePlus size={17} />}
          title={t('toolbar.uploadNode')}
          active={uploadIntent !== null}
          disabled={uploadIntent !== null}
          onClick={onUploadMedia}
        />
        <ToolSeparator />
        <ToolBtn
          icon={<Clock3 size={17} />}
          title={t('sidebar.historyAssets')}
          active={activePanel === 'history'}
          onClick={() => handleTogglePanel('history')}
        />
      </div>

      {activePanel ? (
        <SlidePanel onClose={handleClosePanel}>
          <Suspense fallback={<SidebarPanelLoading />}>
            {activePanel === 'history' ? (
              <HistoryPanel
                projectId={projectId}
                onSelectAsset={onInsertHistoryAsset}
              />
            ) : null}
          </Suspense>
        </SlidePanel>
      ) : null}
    </>
  );
}

function ToolBtn({
  icon,
  title,
  active,
  disabled = false,
  tone = 'default',
  onClick,
}: {
  icon: ReactNode;
  title: string;
  active: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  const idleTone =
    tone === 'danger'
      ? 'text-[var(--beatcanvas-error)] hover:border-[var(--beatcanvas-error)]/20 hover:bg-[#3a2025] hover:text-[#ff9aa1]'
      : 'text-[var(--beat-text-2)] hover:border-white/[0.07] hover:bg-white/[0.05] hover:text-[var(--beat-text-1)]';

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.94] ${
        active
          ? 'border-white/[0.12] bg-white/[0.08] text-[var(--beat-text-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_22px_rgba(0,0,0,0.4)]'
          : idleTone
      } disabled:cursor-wait disabled:opacity-55`}
      aria-pressed={active}
    >
      {icon}
      <span className="pointer-events-none absolute left-[calc(100%+11px)] top-1/2 z-[90] -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-[8px] border border-white/10 bg-[var(--beat-surface-2)]/95 px-2.5 py-1.5 text-[11px] font-medium text-[var(--beat-text-1)] opacity-0 shadow-[0_10px_28px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
        {title}
      </span>
    </button>
  );
}

function ToolSeparator() {
  return (
    <div className="my-0.5 h-px w-7 bg-gradient-to-r from-transparent via-white/[0.13] to-transparent" />
  );
}

function SlidePanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="beat-slide-in pointer-events-auto absolute left-20 top-[39%] z-40 max-h-[calc(100%-80px)] w-[280px] -translate-y-1/2 overflow-hidden rounded-[var(--beat-radius-sm)] border border-white/[0.12] bg-[var(--beatcanvas-panel)] text-[var(--beat-text-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_64px_rgba(0,0,0,0.46)] backdrop-blur-2xl"
    >
      <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function SidebarPanelLoading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 p-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-[10px] bg-white/[0.05]"
        />
      ))}
    </div>
  );
}
