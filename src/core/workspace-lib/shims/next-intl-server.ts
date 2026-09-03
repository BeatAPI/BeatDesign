/**
 * Shim for `next-intl/server`.
 *
 * BeatDesign's server actions (subscribe-newsletter, send-message) call
 * `getLocale()` from `next-intl/server`. TanStack uses Paraglide for i18n,
 * whose `getLocale()` lives in `@/paraglide/runtime.js` and returns the
 * same locale string ('en' | 'zh' | 'ja'). We re-export it under the expected
 * name so server code copied from BeatDesign compiles unchanged.
 */
export { getLocale } from '@/paraglide/runtime.js';

// Re-export the Locale type + locale list for convenience.
export type { Locale } from './next-intl';
export { DEFAULT_LOCALE, LOCALES } from './next-intl';
