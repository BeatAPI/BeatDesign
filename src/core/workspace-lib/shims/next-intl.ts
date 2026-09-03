/**
 * Shim for next-intl's useTranslations / useLocale hooks.
 *
 * BeatDesign code calls `useTranslations('Namespace')` then `t('key')`. Under
 * TanStack we resolve these against the Paraglide message tree so real
 * translations are returned (the project baseLocale is `en`). Nested keys
 * use dot notation: t('sidebar.addNode').
 */

// Paraglide compiles messages into typed accessor functions. For the shim we
// load the raw JSON tree at runtime and resolve keys by path — simpler than
// mapping every key to a paraglide function and covers arbitrary namespaces.
import zhMessages from '@/../messages/zh.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import { getLocale } from '@/paraglide/runtime.js';

const MESSAGE_TREES: Record<string, Record<string, unknown>> = {
  zh: zhMessages,
  en: enMessages,
  ja: jaMessages,
};

function resolveKey(tree: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = tree;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function useTranslations(namespace?: string) {
  const locale = getLocale();
  return function t(key: string, params?: Record<string, string | number>): string {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const tree = MESSAGE_TREES[locale] ?? MESSAGE_TREES.en;
    let result = resolveKey(tree, fullKey);
    // Fallback to English if the key is missing in the current locale.
    if (result === undefined && locale !== 'en') {
      result = resolveKey(MESSAGE_TREES.en, fullKey);
    }
    // Final fallback: return the key itself (better than crashing).
    if (result === undefined) result = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  };
}

export function getTranslations(namespace?: string) {
  const locale = getLocale();
  return async function t(key: string, params?: Record<string, string | number>): Promise<string> {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const tree = MESSAGE_TREES[locale] ?? MESSAGE_TREES.en;
    let result = resolveKey(tree, fullKey);
    if (result === undefined && locale !== 'en') {
      result = resolveKey(MESSAGE_TREES.en, fullKey);
    }
    if (result === undefined) result = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  };
}

// useLocale shim — returns the current paraglide locale (en by default).
export function useLocale(): string {
  return getLocale();
}

export type Locale = string;

export const DEFAULT_LOCALE = 'en';
export const LOCALES = ['en', 'zh', 'ja'];

export type Messages = typeof enMessages;

/**
 * Default (en) message tree. BeatDesign code accesses nested keys such as
 * `defaultMessages.Metadata.title`, so the shim mirrors that structure.
 */
type MessagesType = {
  [key: string]: any;
};

export const defaultMessages = (MESSAGE_TREES.en as MessagesType) ?? {};
