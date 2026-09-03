import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBeatDesignWorkspaceHandoff,
  formatBeatDesignWorkspaceHandoff,
} from './workspace-handoff';

test('Canvas handoff focuses the requested card and preserves host metadata', () => {
  const handoff = buildBeatDesignWorkspaceHandoff({
    projectId: 'project 1',
    name: 'Launch board',
    view: 'canvas',
    focusCardId: 'card:hero',
  });

  assert.match(handoff.canvasUrl, /\/canvas\/project%201\?focus=card%3Ahero$/);
  assert.equal(handoff.workspaceUrl, handoff.canvasUrl);
  assert.equal(handoff.browserHandoff.skill, 'browser:control-in-app-browser');
  assert.equal(handoff.browserHandoff.makeVisible, true);
  assert.match(handoff.browserHandoff.url, /beatdesignLaunchSurface=in_app_browser/);
  assert.match(formatBeatDesignWorkspaceHandoff(handoff), /browserHandoff\.url/);
});

test('Editor handoff clamps negative time and exposes every workspace URL', () => {
  const handoff = buildBeatDesignWorkspaceHandoff({
    projectId: 'project-1',
    name: 'Rough cut',
    view: 'editor',
    time: -2,
  });

  assert.match(handoff.editorUrl, /\/editor\/project-1\?t=0$/);
  assert.equal(handoff.workspaceUrl, handoff.editorUrl);
  assert.ok(handoff.studioUrl.includes('/studio/project-1'));
  assert.ok(handoff.assetsUrl.includes('/assets/project-1'));
});
