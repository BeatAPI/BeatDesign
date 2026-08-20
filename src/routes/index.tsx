import { createFileRoute } from '@tanstack/react-router';

import { BeatApiProductHome } from '@/components/marketing/beatapi-product-home';
import { envConfigs } from '@/config';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';
import { m } from '@/paraglide/messages.js';

export const Route = createFileRoute('/')({
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale === 'zh' ? 'zh' : 'en';
    return {
      meta: [
        { title: m['product.home.metaTitle']({}, { locale }) },
        {
          name: 'description',
          content: m['product.home.metaDescription']({}, { locale }),
        },
        { property: 'og:url', content: envConfigs.app_url },
      ],
    };
  },
  component: HomeRouteComponent,
});

function HomeRouteComponent() {
  const { locale } = Route.useLoaderData();
  return <BeatApiProductHome locale={locale} />;
}
