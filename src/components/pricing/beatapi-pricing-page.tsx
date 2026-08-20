import { ArrowRight, CheckCircle2, Film, Image, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BeatApiProductShell } from '@/components/marketing/beatapi-product-shell';
import {
  avgSavingsPercent,
  comparisonGroups,
  maxSavingsPercent,
  type PricingCategory,
} from '@/components/pricing/pricing-comparison-data';
import {
  PricingModelCard,
  type PricingComparisonLabels,
} from '@/components/pricing/pricing-comparison-table';
import { Input } from '@/components/ui/input';
import { envConfigs } from '@/config';
import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

type CategoryFilter = 'all' | PricingCategory;

function getPricingCopy(locale: string) {
  const messageLocale = locale === 'zh' ? 'zh' : 'en';
  return {
    titleLead: m['product.pricing.titleLead']({}, { locale: messageLocale }),
    titleAccent: m['product.pricing.titleAccent']({}, { locale: messageLocale }),
    descriptionLead: m['product.pricing.descriptionLead'](
      {},
      { locale: messageLocale }
    ),
    descriptionRest: m['product.pricing.descriptionRest'](
      {},
      { locale: messageLocale }
    ),
    statCheaperHint: m['product.pricing.statCheaperHint'](
      {},
      { locale: messageLocale }
    ),
    statSavingsHint: m['product.pricing.statSavingsHint'](
      {},
      { locale: messageLocale }
    ),
    filterAll: m['product.pricing.filterAll']({}, { locale: messageLocale }),
    filterVideo: m['product.pricing.filterVideo']({}, { locale: messageLocale }),
    filterImage: m['product.pricing.filterImage']({}, { locale: messageLocale }),
    search: m['product.pricing.search']({}, { locale: messageLocale }),
    empty: m['product.pricing.empty']({}, { locale: messageLocale }),
    colSpec: m['product.pricing.colSpec']({}, { locale: messageLocale }),
    colDiscount: m['product.pricing.colDiscount'](
      {},
      { locale: messageLocale }
    ),
    colCompetitor: m['product.pricing.colCompetitor'](
      {},
      { locale: messageLocale }
    ),
    colHiggsfield: m['product.pricing.colHiggsfield'](
      {},
      { locale: messageLocale }
    ),
    ctaPrimary: m['product.pricing.ctaPrimary']({}, { locale: messageLocale }),
  };
}

export function BeatApiPricingPage({ locale }: { locale: string }) {
  const copy = getPricingCopy(locale);
  const messageLocale = locale === 'zh' ? 'zh' : 'en';
  const maxSavings = maxSavingsPercent();
  const avgSavings = avgSavingsPercent();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');

  const labels: PricingComparisonLabels = {
    spec: copy.colSpec,
    beatapi: envConfigs.app_name,
    competitor: copy.colCompetitor,
    higgsfield: copy.colHiggsfield,
    discount: copy.colDiscount,
  };

  const categoryTabs = [
    { value: 'all' as const, icon: CheckCircle2, label: copy.filterAll },
    { value: 'video' as const, icon: Film, label: copy.filterVideo },
    { value: 'image' as const, icon: Image, label: copy.filterImage },
  ];

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return comparisonGroups.filter((group) => {
      if (category !== 'all' && group.category !== category) return false;
      if (!needle) return true;
      return `${group.model} ${group.specs.map((spec) => `${spec.spec} ${spec.specZh}`).join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
  }, [category, query]);

  return (
    <BeatApiProductShell active="pricing" locale={locale}>
      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-14 sm:px-6">
        <section className="grid gap-10 pt-4 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <h1
              aria-label={`${copy.titleLead}${copy.titleAccent}`}
              className="beat-product-display text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.045em] text-[var(--beat-text-1)] sm:text-[3.75rem] lg:text-[4.25rem]"
            >
              {copy.titleLead}
              <span className="italic text-[var(--beat-accent)]">{copy.titleAccent}</span>
            </h1>
            <p className="mt-5 text-[14px] font-normal leading-6 text-[var(--beat-text-2)] sm:text-[15px]">
              <span className="block">{copy.descriptionLead}</span>
              <span className="block">{copy.descriptionRest}</span>
            </p>
          </div>
          <div className="flex items-end justify-start gap-10 sm:gap-14 lg:justify-end">
            <div>
              <p className="beat-product-display text-[5rem] leading-none font-semibold tracking-[-0.05em] text-[var(--beat-accent)] tabular-nums sm:text-[6.5rem]">
                {maxSavings}%
              </p>
              <p className="mt-3 text-[13px] font-medium text-[var(--beat-accent)]/80">
                {copy.statCheaperHint}
              </p>
            </div>
            <div className="pb-1">
              <p className="beat-product-display text-[2.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#f6f6f4] sm:text-[3.25rem]">
                {avgSavings}%
              </p>
              <p className="mt-3 text-[13px] text-white/45">
                {copy.statSavingsHint}
              </p>
            </div>
          </div>
        </section>

        <section id="model-pricing" className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                    category === value
                      ? 'bg-[#f6f6f4] text-[#111113]'
                      : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/80'
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                  <span className="text-[11px] opacity-70">
                    {value === 'all'
                      ? comparisonGroups.length
                      : comparisonGroups.filter((group) => group.category === value)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="h-9 border-white/[0.08] bg-white/[0.03] pl-9 text-[13px] text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            {groups.map((group) => (
              <PricingModelCard
                key={group.model}
                group={group}
                locale={messageLocale}
                labels={labels}
              />
            ))}
            {groups.length === 0 ? (
              <div className="rounded-[var(--beat-radius)] border border-white/[0.08] px-6 py-16 text-center text-[13px] text-white/40">
                {copy.empty}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-14">
          <Link
            href="/studio"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--beat-radius-sm)] bg-[var(--beat-accent)] px-6 text-[13px] font-semibold text-[var(--beat-accent-ink)] shadow-[0_8px_28px_rgba(255,122,51,0.22)] transition hover:bg-[#ff8a4d]"
          >
            {copy.ctaPrimary}
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    </BeatApiProductShell>
  );
}
