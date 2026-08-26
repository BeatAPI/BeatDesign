import pricingCatalog from '@/components/pricing/pricing-catalog.json';

export const HIGGSFIELD_PLAN_USD = 19;
export const HIGGSFIELD_PLAN_CREDITS = 270;
export const HIGGSFIELD_USD_PER_CREDIT =
  HIGGSFIELD_PLAN_USD / HIGGSFIELD_PLAN_CREDITS;

export type PricingCategory = 'video' | 'image' | 'workflow' | 'realtime';

export type ComparisonSpec = {
  id: string;
  spec: string;
  specZh: string;
  beatapi: number;
  competitor?: number;
  higgsfieldCredits?: number;
  billingUnit?: 'second';
  beatapiUnitPrice?: number;
  competitorUnitPrice?: number;
  exampleQuantity?: number;
};

export type ComparisonGroup = {
  model: string;
  family?: string;
  category: PricingCategory;
  specs: ComparisonSpec[];
};

export const comparisonGroups = pricingCatalog.groups as ComparisonGroup[];

export function countPricingModelFamilies(
  category?: PricingCategory
): number {
  return new Set(
    comparisonGroups
      .filter((group) => category === undefined || group.category === category)
      .map((group) => group.family ?? group.model)
  ).size;
}

export function higgsfieldPrice(spec: ComparisonSpec): number | undefined {
  if (spec.higgsfieldCredits === undefined) return undefined;
  const price = roundPrice(spec.higgsfieldCredits * HIGGSFIELD_USD_PER_CREDIT);
  if (price < spec.beatapi) return undefined;
  return price;
}

export function competitorDiscount(spec: ComparisonSpec): number | undefined {
  if (spec.competitor === undefined) return undefined;
  return roundDiscount((1 - spec.beatapi / spec.competitor) * 100);
}

export function higgsfieldDiscount(spec: ComparisonSpec): number | undefined {
  const price = higgsfieldPrice(spec);
  if (price === undefined) return undefined;
  return roundDiscount((1 - spec.beatapi / price) * 100);
}

export function bestDiscount(spec: ComparisonSpec): number | undefined {
  const discounts = [competitorDiscount(spec), higgsfieldDiscount(spec)].filter(
    (value): value is number => value !== undefined
  );
  if (discounts.length === 0) return undefined;
  return Math.max(...discounts);
}

export function comparableSpecs(): ComparisonSpec[] {
  return comparisonGroups.flatMap((group) => group.specs);
}

export function maxSavingsPercent(): number {
  const discounts = comparableSpecs()
    .map((spec) => competitorDiscount(spec))
    .filter((value): value is number => value !== undefined && value > 0);
  return Math.round(Math.max(0, ...discounts));
}

export function avgSavingsPercent(): number {
  const discounts = comparableSpecs()
    .map((spec) => competitorDiscount(spec))
    .filter((value): value is number => value !== undefined && value > 0);
  if (discounts.length === 0) return 0;
  return Math.round(
    discounts.reduce((sum, value) => sum + value, 0) / discounts.length
  );
}

export function maxHiggsfieldSavingsPercent(): number {
  const discounts = comparableSpecs()
    .map((spec) => higgsfieldDiscount(spec))
    .filter((value): value is number => value !== undefined && value > 0);
  return Math.round(Math.max(0, ...discounts));
}

function roundPrice(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundDiscount(value: number): number {
  return Math.round(value * 10) / 10;
}
