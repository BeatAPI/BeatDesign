'use client';

import { m } from '@/paraglide/messages.js';

type BeatCanvasNodeLocale = 'en' | 'zh';
type BeatCanvasNodeCopy = {
  imageGeneration: string;
  videoGeneration: string;
  image: string;
  video: string;
  pending: string;
  processing: string;
  generationFailed: string;
  history: string;
  versions: string;
  latestResult: string;
  viewResult: string;
};

const resolveBeatCanvasNodeLocale = (): BeatCanvasNodeLocale => {
  if (typeof document !== 'undefined') {
    const documentLocale = document.documentElement.lang.trim().toLowerCase();
    if (documentLocale.startsWith('zh')) {
      return 'zh';
    }
    if (documentLocale.startsWith('en')) {
      return 'en';
    }
  }

  if (typeof navigator !== 'undefined') {
    const browserLocale = navigator.language.trim().toLowerCase();
    if (browserLocale.startsWith('en')) {
      return 'en';
    }
    if (browserLocale.startsWith('zh')) {
      return 'zh';
    }
  }

  return 'zh';
};

const getNodeCopyForLocale = (locale: BeatCanvasNodeLocale): BeatCanvasNodeCopy => ({
  imageGeneration: m['AppShell.studio.canvas.shapes.imageGeneration'](
    {},
    { locale }
  ),
  videoGeneration: m['AppShell.studio.canvas.shapes.videoGeneration'](
    {},
    { locale }
  ),
  image: m['AppShell.studio.canvas.shapes.image']({}, { locale }),
  video: m['AppShell.studio.canvas.shapes.video']({}, { locale }),
  pending: m['AppShell.studio.canvas.shapes.pending']({}, { locale }),
  processing: m['AppShell.studio.canvas.shapes.processing']({}, { locale }),
  generationFailed: m['AppShell.studio.canvas.shapes.generationFailed'](
    {},
    { locale }
  ),
  history: m['AppShell.studio.canvas.shapes.history']({}, { locale }),
  versions: m['AppShell.studio.canvas.shapes.versions']({}, { locale }),
  latestResult: m['AppShell.studio.canvas.shapes.latestResult'](
    {},
    { locale }
  ),
  viewResult: m['AppShell.studio.canvas.shapes.viewResult']({}, { locale }),
});

export const getBeatCanvasNodeCopy = () =>
  getNodeCopyForLocale(resolveBeatCanvasNodeLocale());
