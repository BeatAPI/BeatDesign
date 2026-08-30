import handler from '@tanstack/react-start/server-entry';

import { getWwwRedirectLocation } from './lib/canonical-url';
import { normalizeProjectAssetMediaRequest } from './lib/project-asset-media-request';
import { paraglideMiddleware } from './paraglide/server.js';

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

    const routedRequest = normalizeProjectAssetMediaRequest(req);
    return paraglideMiddleware(routedRequest, () => handler.fetch(routedRequest));
  },
};
