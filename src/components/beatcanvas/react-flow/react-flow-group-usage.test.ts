import assert from 'node:assert/strict';
import test from 'node:test';
import { countGroupTimelineUses } from './beatcanvas-react-flow-types';

test('group usage counts real adopted old outputs and repeated clips independently from latest display', () => {
  const cards = [
    { id: 'draft', kind: 'generation' as const, assetId: null },
    {
      id: 'old',
      kind: 'output' as const,
      sourceConfigCardId: 'draft',
      assetId: 'old-asset',
    },
    {
      id: 'latest',
      kind: 'output' as const,
      sourceConfigCardId: 'draft',
      assetId: 'latest-asset',
    },
    {
      id: 'duplicate-output',
      kind: 'output' as const,
      sourceConfigCardId: 'draft',
      assetId: 'old-asset',
    },
    { id: 'still', kind: 'asset' as const, assetId: 'still-asset' },
    {
      id: 'outside',
      kind: 'output' as const,
      sourceConfigCardId: 'other-draft',
      assetId: 'outside-asset',
    },
  ];
  const usage = [
    { assetId: 'old-asset' },
    { assetId: 'old-asset' },
    { assetId: 'latest-asset' },
    { assetId: 'still-asset' },
    { assetId: 'outside-asset' },
    { assetId: null },
  ];
  const before = JSON.stringify({ cards, usage });
  assert.equal(countGroupTimelineUses(cards, ['draft', 'still'], usage), 4);
  assert.equal(
    countGroupTimelineUses(cards, ['draft'], [{ assetId: 'old-asset' }]),
    1
  );
  assert.equal(countGroupTimelineUses(cards, ['draft'], []), 0);
  assert.equal(JSON.stringify({ cards, usage }), before);
});
