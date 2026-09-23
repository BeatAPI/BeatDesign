import type { CompilerOptions } from '@inlang/paraglide-js';

export const paraglideCompilerOptions = {
  project: './project.inlang',
  outdir: './src/paraglide',
  outputStructure: 'message-modules',
  cookieName: 'PARAGLIDE_LOCALE',
  // On unprefixed links, honor a saved choice first, then the browser's
  // preferred language. Explicit /zh and /ja links always win below.
  strategy: ['cookie', 'preferredLanguage', 'url', 'baseLocale'],
  routeStrategies: [
    {
      match: '/zh/:path(.*)?',
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
    },
    {
      match: '/ja/:path(.*)?',
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
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
