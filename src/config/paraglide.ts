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
      ],
    },
    // English is the primary locale and stays unprefixed; Chinese uses /zh.
    {
      pattern: '/',
      localized: [
        ['en', '/'],
        ['zh', '/zh'],
      ],
    },
    // "as-needed" prefix: English unprefixed, Chinese under /zh.
    {
      pattern: '/:path(.*)?',
      localized: [
        ['zh', '/zh/:path(.*)?'],
        ['en', '/:path(.*)?'],
      ],
    },
  ],
} satisfies CompilerOptions;
