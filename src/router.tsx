import { createRouter } from '@tanstack/react-router';

import { deLocalizeUrl, localizeUrl } from '@/paraglide/runtime.js';

import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    // Paraglide owns locale prefixes: incoming URLs are de-localized before
    // matching (routes are locale-free), outgoing hrefs get re-localized.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
