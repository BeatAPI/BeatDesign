import handler from '@tanstack/react-start/server-entry';

import { runDueGenerationStatusPasses } from './core/effects/server-poller';
import { cleanupStaleGenerations } from './core/effects/stale-generations';
import { getWwwRedirectLocation } from './lib/canonical-url';
import { paraglideMiddleware } from './paraglide/server.js';

// On Cloudflare Workers, stash the binding env (D1, ASSETS, …) on globalThis
// so synchronous code paths (e.g. the db() singleton with DATABASE_PROVIDER=d1)
// can reach bindings without threading the request context through every call.
// The specifier is kept non-literal so bundlers leave the import to runtime;
// outside workerd the import rejects and we just move on.
const CF_WORKERS_MODULE = 'cloudflare:workers';
let cfEnvPromise: Promise<void> | null = null;

function ensureCloudflareEnv(): Promise<void> {
  if (!cfEnvPromise) {
    cfEnvPromise = import(/* @vite-ignore */ CF_WORKERS_MODULE)
      .then((mod) => {
        (globalThis as any).__CF_ENV__ = mod.env;
      })
      .catch(() => {
        // Not running on Cloudflare Workers — nothing to stash.
      });
  }
  return cfEnvPromise;
}

// Custom server entry — wraps every request in Paraglide's middleware so
// getLocale() resolves per-request (AsyncLocalStorage) during SSR.
export default {
  async fetch(req: Request): Promise<Response> {
    const redirectLocation = getWwwRedirectLocation(req.url);
    if (redirectLocation) {
      return new Response(null, {
        status: 301,
        headers: {
          Location: redirectLocation,
        },
      });
    }

    await ensureCloudflareEnv();
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
  async scheduled(
    _controller: unknown,
    _env: unknown,
    ctx?: { waitUntil?: (promise: Promise<unknown>) => void }
  ): Promise<void> {
    const task = (async () => {
      await ensureCloudflareEnv();
      const [statusResult, cleanupResult] = await Promise.all([
        runDueGenerationStatusPasses({ limit: 25 }),
        cleanupStaleGenerations(),
      ]);
      console.log('effects scheduled pass complete', {
        statusResult,
        cleanupResult,
      });
    })();

    if (ctx?.waitUntil) {
      ctx.waitUntil(task);
      return;
    }

    await task;
  },
};
