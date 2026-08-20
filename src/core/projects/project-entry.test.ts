import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPostCreateProjectDetailPath,
  serializeProjectCenterCard,
} from './project-entry';

test('keeps prompt query after creation so the workspace can resume the intent', () => {
  const path = buildPostCreateProjectDetailPath({
    locale: 'zh',
    projectId: 'project-1',
    target: 'image',
    model: 'gpt-image-2',
    prompt: 'new product hero',
    mode: 'studio',
  });

  assert.equal(
    path,
    '/zh/studio/project-1?target=image&model=gpt-image-2&prompt=new+product+hero'
  );
});

test('serializes the last workspace mode so project cards resume in place', () => {
  const card = serializeProjectCenterCard({
    id: 'project-1',
    name: 'Campaign launch',
    lastWorkspaceMode: 'studio',
    updatedAt: new Date('2026-08-15T10:00:00.000Z'),
  });

  assert.equal(card.lastWorkspaceMode, 'studio');
});
