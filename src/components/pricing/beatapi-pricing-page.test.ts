import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(
  new URL('./beatapi-pricing-page.tsx', import.meta.url),
  'utf8'
);
const tableSource = readFileSync(
  new URL('./pricing-comparison-table.tsx', import.meta.url),
  'utf8'
);
const routeSource = readFileSync(
  new URL('../../routes/pricing.tsx', import.meta.url),
  'utf8'
);

test('pricing stays a real page on the shared product shell', () => {
  assert.match(routeSource, /BeatApiPricingPage/);
  assert.doesNotMatch(routeSource, /redirect/);
  assert.match(pageSource, /BeatApiProductShell/);
  assert.match(pageSource, /active="pricing"/);
});

test('pricing copies the official BeatAPI model-card structure', () => {
  assert.match(pageSource, /PricingModelCard/);
  assert.match(pageSource, /filterAll/);
  assert.match(pageSource, /id="model-pricing"/);
  assert.match(tableSource, /group\.model/);
  assert.doesNotMatch(pageSource, /comparisonCatalog/);
});

test('pricing keeps Higgsfield as a first-class comparison column', () => {
  assert.match(pageSource, /colHiggsfield/);
  assert.match(tableSource, /higgsfieldPrice/);
  assert.match(tableSource, /bestDiscount/);
  assert.doesNotMatch(tableSource, /higgsfieldDiscount/);
  assert.doesNotMatch(pageSource, /faqTitle/);
  assert.doesNotMatch(pageSource, /noteCompetitor/);
  assert.doesNotMatch(pageSource, /filterWorkflow/);
  assert.doesNotMatch(pageSource, /statHiggsfieldHint/);
  assert.doesNotMatch(pageSource, /eyebrow/);
});
