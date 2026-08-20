import type { Locale } from '@/core/workspace-lib/shims/next-intl';
import { create } from 'zustand';

interface LocaleState {
  currentLocale: Locale;
  setCurrentLocale: (locale: Locale) => void;
}

/**
 * Zustand create function
 * create lets you create a React Hook with API utilities attached.
 *
 * https://zustand.docs.pmnd.rs/apis/create
 */
export const useLocaleStore = create<LocaleState>((set) => ({
  currentLocale: '', // don't change, it will affect the language detection switch judgment
  setCurrentLocale: (locale) =>
    set((state) => ({
      currentLocale: locale,
    })),
}));
