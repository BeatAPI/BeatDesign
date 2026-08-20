import { paraglideVitePlugin } from '@inlang/paraglide-js';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

import { loadEnvFiles } from './src/lib/env';

// Populate process.env from .env.local / .env.{NODE_ENV} / .env for the
// dev server and build process (Vite only exposes VITE_* via import.meta.env;
// server code reads secrets from process.env). In production, env comes
// from the actual host/container environment.
loadEnvFiles();

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 3020,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    // MDX must run before the react plugin so JSX in compiled MDX gets transformed.
    { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react' }) },
    tailwindcss(),
    paraglideVitePlugin({
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
            // Keep the prefixed pattern first so de-localization does not let
            // the catch-all English pattern consume Chinese URLs.
            ['en', '/:path(.*)?'],
          ],
        },
      ],
    }),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(),
  ],
});
