import { notFound, useLoaderData } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import type { ComponentType } from 'react';

import { envConfigs } from '@/config';
import { baseLocale, getLocale, localizeUrl } from '@/paraglide/runtime.js';

type PageMeta = {
  title: string;
  description: string;
  updated_at: string;
};

type PageModule = {
  default: ComponentType;
  meta: PageMeta;
};

// Eagerly bundle the static content pages (small legal/info MDX files).
// Keys are absolute from the project root.
const pages = import.meta.glob<PageModule>('/src/content/pages/*.mdx', {
  eager: true,
});

function loadPage(slug: string, locale: string): PageModule | null {
  return (
    pages[`/src/content/pages/${slug}.${locale}.mdx`] ??
    pages[`/src/content/pages/${slug}.${baseLocale}.mdx`] ??
    null
  );
}

type LoaderData = { meta: PageMeta; slug: string; locale: string };

// Shared route options for static MDX pages. Each page gets its own
// explicit route file (e.g. privacy-policy.tsx) so static segments
// always outrank dynamic ones — add a new page by creating the MDX
// content plus a thin route file using this factory.
export function staticPageRouteOptions(slug: string) {
  return {
    loader: (): LoaderData => {
      const locale = getLocale();
      const page = loadPage(slug, locale);
      if (!page) throw notFound();
      return { meta: page.meta, slug, locale };
    },
    head: ({ loaderData }: { loaderData?: LoaderData }) => {
      if (!loaderData) return {};
      const { meta, locale } = loaderData;
      const canonical = localizeUrl(`${envConfigs.app_url}/${slug}`, {
        locale: locale as ReturnType<typeof getLocale>,
      }).href;
      return {
        meta: [
          { title: meta.title },
          { name: 'description', content: meta.description },
        ],
        links: [{ rel: 'canonical', href: canonical }],
      };
    },
    component: StaticPage,
  };
}

function StaticPage() {
  const { meta, slug, locale } = useLoaderData({
    strict: false,
  }) as LoaderData;

  const page = loadPage(slug, locale)!;
  const Content = page.default;

  return (
    <article>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {meta.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {meta.description}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {m["common.pages.last_updated"]()}: {meta.updated_at}
        </p>
      </header>
      <div className="text-[15px] leading-7 text-foreground/90">
        <Content />
      </div>
    </article>
  );
}
