import type { CompilerOptions } from '@inlang/paraglide-js';

export const paraglideCompilerOptions = {
  project: './project.inlang',
  outdir: './src/paraglide',
  outputStructure: 'message-modules',
  cookieName: 'PARAGLIDE_LOCALE',
  // Persist across browser restarts, renewing on each visit (400 days).
  cookieMaxAge: 60 * 60 * 24 * 400,
  // A saved choice wins even when opening an old localized bookmark.
  // Without a cookie, unprefixed links use the browser's preferred language;
  // explicit /zh and /ja links use their locale before browser detection.
  strategy: ['cookie', 'preferredLanguage', 'url', 'baseLocale'],
  routeStrategies: [
    {
      match: '/zh/:path(.*)?',
      strategy: ['cookie', 'url', 'preferredLanguage', 'baseLocale'],
    },
    {
      match: '/ja/:path(.*)?',
      strategy: ['cookie', 'url', 'preferredLanguage', 'baseLocale'],
    },
  ],
  urlPatterns: [
    // API endpoints are never locale-prefixed.
    {
      pattern: '/api/:path(.*)?',
      localized: [
        ['zh', '/api/:path(.*)?'],
        ['en', '/api/:path(.*)?'],
        ['ja', '/api/:path(.*)?'],
      ],
    },
    // English is the primary locale and stays unprefixed; Chinese uses /zh.
    {
      pattern: '/',
      localized: [
        ['en', '/'],
        ['zh', '/zh'],
        ['ja', '/ja'],
      ],
    },
    // "as-needed" prefix: English unprefixed, Chinese and Japanese prefixed.
    {
      pattern: '/:path(.*)?',
      localized: [
        ['zh', '/zh/:path(.*)?'],
        ['ja', '/ja/:path(.*)?'],
        ['en', '/:path(.*)?'],
      ],
    },
  ],
} satisfies CompilerOptions;
