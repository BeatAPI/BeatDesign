import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Fresh client per SSR request (never share cache across users);
// singleton in the browser so client-side navigation reuses the cache.
let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}
