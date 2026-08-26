import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avgSavingsPercent,
  bestDiscount,
  comparisonGroups,
  competitorDiscount,
  countPricingModelFamilies,
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
    names.slice(3, 7),
    ['Seedance 2.0', 'Seedance 2.0 Mini', 'Seedance 2.0 Fast', 'Seedance 2.5']
  );
  assert.equal(new Set(names).size, names.length);
});

test('pricing filters count selectable model families rather than variant cards', () => {
  assert.equal(countPricingModelFamilies(), 13);
  assert.equal(countPricingModelFamilies('video'), 8);
  assert.equal(countPricingModelFamilies('image'), 5);
});

test('Grok pricing matches the official BeatAPI list prices', () => {
  const image = comparisonGroups.find(
    (group) => group.model === 'Grok Imagine Image 2.0'
  );
  const video = comparisonGroups.find(
    (group) => group.model === 'Grok Imagine Video 1.5'
  );

  assert.equal(image?.specs[0]?.beatapi, 0.03);
  assert.equal(image?.specs[0]?.competitor, 0.04);
  const video480 = video?.specs.find((spec) => spec.id.endsWith('480p'));
  const video720 = video?.specs.find((spec) => spec.id.endsWith('720p'));
  const video1080 = video?.specs.find((spec) => spec.id.endsWith('1080p'));
  assert.equal(video480?.beatapiUnitPrice, 0.025);
  assert.equal(video480?.exampleQuantity, 8);
  assert.equal(video480?.beatapi, 0.025 * 8);
  assert.match(video480?.spec ?? '', /8 sec example/);
  assert.equal(video720?.beatapiUnitPrice, 0.05);
  assert.equal(video720?.exampleQuantity, 8);
  assert.equal(video720?.beatapi, 0.05 * 8);
  assert.match(video720?.specZh ?? '', /8 秒示例/);
  assert.equal(video1080?.beatapiUnitPrice, 0.09);
  assert.equal(video1080?.competitorUnitPrice, 0.25);
  assert.equal(video1080?.exampleQuantity, 8);
  assert.equal(video1080?.beatapi, 0.09 * 8);
  assert.equal(video1080?.competitor, 0.25 * 8);
  assert.match(video1080?.specZh ?? '', /最多 1 张图/);
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

test('Higgsfield stays blank when it is cheaper than BeatAPI', () => {
  const specs = comparisonGroups.flatMap((group) => group.specs);
  const kling3mc720 = specs.find((spec) => spec.id === 'kling-3-motion-control-720p');
  const seedream2k = specs.find((spec) => spec.id === 'seedream-5-pro-2k');
  assert.equal(higgsfieldPrice(kling3mc720!), undefined);
  assert.equal(higgsfieldPrice(seedream2k!), undefined);
});

test('Kling motion control cards match the official BeatAPI list prices', () => {
  const kling26 = comparisonGroups.find(
    (group) => group.model === 'Kling 2.6 Motion Control'
  );
  const kling3mc = comparisonGroups.find(
    (group) => group.model === 'Kling 3.0 Motion Control'
  );
  assert.ok(kling26);
  assert.ok(kling3mc);
  assert.equal(
    kling26.specs.find((spec) => spec.id === 'kling-2.6-motion-control-720p')
      ?.beatapi,
    0.3
  );
  assert.equal(
    kling26.specs.find((spec) => spec.id === 'kling-2.6-motion-control-1080p')
      ?.beatapi,
    0.5
  );
  assert.equal(
    kling3mc.specs.find((spec) => spec.id === 'kling-3-motion-control-720p')
      ?.beatapi,
    0.55
  );
  assert.equal(
    kling3mc.specs.find((spec) => spec.id === 'kling-3-motion-control-1080p')
      ?.beatapi,
    0.7
  );
});

test('headline savings match the official BeatAPI comparison', () => {
  assert.equal(maxSavingsPercent(), 81);
  assert.equal(avgSavingsPercent(), 44);
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
