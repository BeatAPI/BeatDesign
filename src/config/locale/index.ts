export const supportedLocales = ['en', 'zh', 'ja'] as const;

export type AppLocale = (typeof supportedLocales)[number];

// Native display names for the language switcher UI.
export const localeNames: Record<AppLocale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

export function normalizeLocale(locale?: string | null): AppLocale {
  const normalized = locale?.trim().toLowerCase() ?? '';
  return supportedLocales.find((item) => normalized.startsWith(item)) ?? 'en';
}
