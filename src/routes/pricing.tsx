import { createFileRoute } from '@tanstack/react-router';

import { BeatApiPricingPage } from '@/components/pricing/beatapi-pricing-page';
import { envConfigs } from '@/config';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';

export const Route = createFileRoute('/pricing')({
  loader: () => ({ locale: getLocale() }),
  head: () => ({
    meta: [
      { title: `Pricing · ${envConfigs.app_name}` },
      {
        name: 'description',
        content:
          'Pay less for the same models. Compare BeatAPI against fal.ai, Replicate, WaveSpeed, and Higgsfield on matched specs.',
      },
    ],
  }),
  component: PricingRouteComponent,
});

function PricingRouteComponent() {
  const { locale } = Route.useLoaderData();

  return <BeatApiPricingPage locale={locale} />;
}
