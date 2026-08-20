import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avgSavingsPercent,
  bestDiscount,
  comparisonGroups,
  competitorDiscount,
  higgsfieldPrice,
  HIGGSFIELD_USD_PER_CREDIT,
  maxHiggsfieldSavingsPercent,
  maxSavingsPercent,
} from './pricing-comparison-data';

test('workflow and realtime exclusive cards stay off the public page for now', () => {
  const names = comparisonGroups.map((group) => group.model);
  assert.equal(
    names.some((name) =>
      ['AI Music Video', 'AI Ecommerce Video', 'Realtime Video'].includes(name)
    ),
    false
  );
});

test('catalog keeps one card per model and groups the Seedance family together', () => {
  const names = comparisonGroups.map((group) => group.model);
  assert.deepEqual(
    names.slice(1, 5),
    ['Seedance 2.0', 'Seedance 2.0 Mini', 'Seedance 2.0 Fast', 'Seedance 2.5']
  );
  assert.equal(new Set(names).size, names.length);
});

test('Seedance 2.0 uses the official BeatAPI list prices', () => {
  const seedance = comparisonGroups.find((group) => group.model === 'Seedance 2.0');
  assert.ok(seedance);
  assert.equal(
    seedance.specs.find((spec) => spec.id === 'seedance-2-720p-no-video')?.beatapi,
    1.05
  );
  assert.equal(
    seedance.specs.find((spec) => spec.id === 'seedance-2-1080p-no-video')?.beatapi,
    2.55
  );
});

test('Higgsfield conversion uses the $19 / 270 plan rate', () => {
  assert.equal(HIGGSFIELD_USD_PER_CREDIT, 19 / 270);
  const seedance720 = comparisonGroups
    .flatMap((group) => group.specs)
    .find((spec) => spec.id === 'seedance-2-720p-no-video');
  assert.equal(higgsfieldPrice(seedance720!), 1.583);
});

test('Higgsfield fills matched video and image specs from the live generate UI', () => {
  const withHiggsfield = comparisonGroups
    .flatMap((group) => group.specs)
    .filter((spec) => spec.higgsfieldCredits !== undefined)
    .map((spec) => spec.id);
  assert.ok(withHiggsfield.includes('minimax-h3-2k'));
  assert.ok(withHiggsfield.includes('seedance-2-720p-no-video'));
  assert.ok(withHiggsfield.includes('seedance-2-fast-720p'));
  assert.ok(withHiggsfield.includes('veo-3.1-quality-720p'));
  assert.ok(withHiggsfield.length >= 20);
});

test('headline savings match the official BeatAPI comparison', () => {
  assert.equal(maxSavingsPercent(), 81);
  assert.equal(avgSavingsPercent(), 46);
  assert.ok(maxHiggsfieldSavingsPercent() >= 80);
  const gpt1k = comparisonGroups
    .flatMap((group) => group.specs)
    .find((spec) => spec.id === 'gpt-image-2-1k');
  assert.equal(competitorDiscount(gpt1k!), 81);
});

test('discount column uses the larger of API competitor and Higgsfield savings', () => {
  const specs = comparisonGroups.flatMap((group) => group.specs);
  const veoFast = specs.find((spec) => spec.id === 'veo-3.1-fast-720p');
  const seedance720 = specs.find((spec) => spec.id === 'seedance-2-720p-no-video');
  assert.equal(bestDiscount(veoFast!), 80.6);
  assert.equal(bestDiscount(seedance720!), 33.7);
});
