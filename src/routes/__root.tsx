/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { envConfigs } from '@/config';
import { getQueryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';

import '@fontsource-variable/figtree';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/space-grotesk';
import '@/styles/globals.css';

export const Route = createRootRoute({
  head: () => {
    const appUrl = envConfigs.app_url || '';
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: envConfigs.app_name },
        { name: 'description', content: envConfigs.app_description },
      ],
      links: [
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: localizeUrl(`${appUrl}/`, { locale: loc }).href,
        })),
      ],
    };
  },
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Outlet />
        <Toaster position="top-center" richColors />
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground">
        {m['common.pages.not_found']()}
      </p>
      <a href="/" className="text-sm underline underline-offset-4">
        {m['common.pages.back_to_home']()}
      </a>
    </div>
  );
}
