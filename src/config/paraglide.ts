import type { CompilerOptions } from '@inlang/paraglide-js';

export const paraglideCompilerOptions = {
  project: './project.inlang',
  outdir: './src/paraglide',
  outputStructure: 'message-modules',
  cookieName: 'PARAGLIDE_LOCALE',
  strategy: ['url', 'cookie', 'baseLocale'],
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
