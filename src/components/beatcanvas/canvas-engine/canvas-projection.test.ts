import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReferenceEdgeId,
  getAbsoluteNodePosition,
  getNodeBounds,
} from './canvas-projection';
import {
  ASSET_CARD_NODE_TYPE,
  WORKFLOW_GROUP_NODE_TYPE,
  type BeatCanvasFlowNode,
} from '../react-flow/beatcanvas-react-flow-types';

const group: BeatCanvasFlowNode = {
  id: 'group',
  type: WORKFLOW_GROUP_NODE_TYPE,
  position: { x: 100, y: 200 },
  data: { meta: {}, props: { w: 500, h: 300 } },
};

const child: BeatCanvasFlowNode = {
  id: 'child',
  type: ASSET_CARD_NODE_TYPE,
  parentId: 'group',
  position: { x: 25, y: 35 },
  data: {
    meta: {},
    props: {
      w: 120,
      h: 80,
      cardMediaType: 'image',
      title: 'Child',
      thumbnailUrl: '',
      fitMode: 'cover',
      chromeMode: 'default',
    },
  },
};

test('projects relative React Flow child positions into absolute canvas frames', () => {
  const byId = new Map([
    [group.id, group],
    [child.id, child],
  ]);

  assert.deepEqual(getAbsoluteNodePosition(child, byId), { x: 125, y: 235 });
  assert.deepEqual(getNodeBounds(child, byId), {
    x: 125,
    y: 235,
    w: 120,
    h: 80,
    minX: 125,
    minY: 235,
    maxX: 245,
    maxY: 315,
    center: { x: 185, y: 275 },
  });
});

test('builds deterministic reference edge ids', () => {
  assert.equal(buildReferenceEdgeId('source', 'target'), 'reference:source:target');
});
