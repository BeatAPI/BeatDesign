import {
  bestDiscount,
  higgsfieldPrice,
  type ComparisonGroup,
  type ComparisonSpec,
} from '@/components/pricing/pricing-comparison-data';
import { cn } from '@/lib/utils';

export type PricingComparisonLabels = {
  spec: string;
  beatapi: string;
  competitor: string;
  higgsfield: string;
  discount: string;
};

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatCompetitorPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatDiscount(value: number): string {
  const abs = Math.abs(value);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return value >= 0 ? `−${text}%` : `+${text}%`;
}

function DiscountCell({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return <span className="text-white/25">—</span>;
  }
  if (value > 0.05) {
    return (
      <span className="font-semibold tabular-nums text-emerald-300">
        {formatDiscount(value)}
      </span>
    );
  }
  if (value < -0.05) {
    return (
      <span className="tabular-nums text-white/45">{formatDiscount(value)}</span>
    );
  }
  return <span className="text-white/35">≈0%</span>;
}

function HiggsfieldCell({ spec }: { spec: ComparisonSpec }) {
  const price = higgsfieldPrice(spec);
  if (price === undefined) {
    return <span className="text-white/25">—</span>;
  }
  return (
    <span className="tabular-nums text-white/55">
      {formatCompetitorPrice(price)}
    </span>
  );
}

export function PricingModelCard({
  group,
  locale,
  labels,
}: {
  group: ComparisonGroup;
  locale: 'en' | 'zh';
  labels: PricingComparisonLabels;
}) {
  return (
    <article className="overflow-hidden rounded-[var(--beat-radius)] border border-white/[0.08] bg-[#101113] shadow-[0_24px_72px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 md:hidden">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#f6f6f4]">
          {group.model}
        </h3>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-[15px] font-semibold tracking-[-0.02em] text-white/40">
              <th className="px-5 py-3.5 font-semibold text-[#f6f6f4]">
                {group.model}
              </th>
              <th className="w-[16%] px-5 py-3.5 text-center font-semibold text-[var(--beat-accent)]">
                {labels.beatapi}
              </th>
              <th className="w-[20%] px-5 py-3.5 text-center font-semibold">
                {labels.competitor}
              </th>
              <th className="w-[16%] px-5 py-3.5 text-center font-semibold">
                {labels.higgsfield}
              </th>
              <th className="w-[14%] px-5 py-3.5 text-center font-semibold">
                {labels.discount}
              </th>
            </tr>
          </thead>
          <tbody>
            {group.specs.map((spec, index) => (
              <tr
                key={spec.id}
                className={cn(
                  'transition-colors hover:bg-white/[0.02]',
                  index !== group.specs.length - 1 && 'border-b border-white/[0.05]'
                )}
              >
                <td className="px-5 py-3.5 text-[13px] text-white/45">
                  {locale === 'zh' ? spec.specZh : spec.spec}
                </td>
                <td className="bg-[#ff7a33]/[0.05] px-5 py-3.5 text-center text-[14px] font-semibold tabular-nums text-[#f6f6f4]">
                  {formatPrice(spec.beatapi)}
                </td>
                <td className="px-5 py-3.5 text-center text-[14px] tabular-nums text-white/50">
                  {spec.competitor !== undefined
                    ? formatCompetitorPrice(spec.competitor)
                    : '—'}
                </td>
                <td className="px-5 py-3.5 text-center text-[14px]">
                  <HiggsfieldCell spec={spec} />
                </td>
                <td className="px-5 py-3.5 text-center text-[14px]">
                  <DiscountCell value={bestDiscount(spec)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-white/[0.05] md:hidden">
        {group.specs.map((spec) => {
          const discount = bestDiscount(spec);
          const hfPrice = higgsfieldPrice(spec);
          return (
            <div key={spec.id} className="px-4 py-3.5">
              <p className="text-[12px] leading-5 text-white/40">
                {locale === 'zh' ? spec.specZh : spec.spec}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold tabular-nums text-[#f6f6f4]">
                    {formatPrice(spec.beatapi)}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-white/35">
                    {spec.competitor !== undefined
                      ? formatCompetitorPrice(spec.competitor)
                      : '—'}
                    {hfPrice !== undefined
                      ? ` · HF ${formatCompetitorPrice(hfPrice)}`
                      : ''}
                  </p>
                </div>
                <DiscountCell value={discount} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
