import { MDXProvider } from '@mdx-js/react';
import { m } from "@/paraglide/messages.js";
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { mdxComponents } from '@/components/mdx-components';
import { Link } from '@/core/i18n/navigation';

export const Route = createFileRoute('/(pages)')({
  component: PagesLayout,
});

function PagesLayout() {

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-8 md:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {m["common.pages.back_to_home"]()}
        </Link>
      </div>
      <div className="mx-auto max-w-3xl px-6 pt-6 pb-12 md:px-8 md:pt-8 md:pb-16">
        <MDXProvider components={mdxComponents}>
          <Outlet />
        </MDXProvider>
      </div>
    </div>
  );
}
