import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  BEATDESIGN_SKILL_CATALOG_URI,
  createBeatDesignSkillRegistry,
  loadBeatDesignSkillRegistry,
  type BeatDesignSkillDefinition,
} from './skill-registry';

const definition = (id = 'ugc-director'): BeatDesignSkillDefinition => ({
  manifest: {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    title: 'UGC Director',
    summary: 'Plan a reviewable UGC production workflow.',
    visibility: 'showcase',
    compatibility: {
      minimumBeatDesignVersion: '0.2.3',
      requiredMcpTools: ['bdesign_canvas_apply'],
    },
    requiredCapabilities: ['image-to-video'],
    inputs: [],
    stages: [],
    showcase: {
      category: 'ugc',
      tags: ['video'],
      featured: true,
    },
  },
  instructions: '# UGC Director\n\nPrepare the Canvas before generation.',
});

test('Skill registry returns descriptors without leaking full instructions', () => {
  const registry = createBeatDesignSkillRegistry({
    definitions: [definition()],
    beatDesignVersion: '0.2.3',
    availableMcpTools: ['bdesign_canvas_apply'],
  });

  const [descriptor] = registry.list();
  assert.equal(descriptor.manifest.id, 'ugc-director');
  assert.equal(descriptor.resourceUri, `${BEATDESIGN_SKILL_CATALOG_URI}/ugc-director`);
  assert.equal(descriptor.compatible, true);
  assert.equal('instructions' in descriptor, false);
  assert.match(registry.get('ugc-director')?.instructions ?? '', /Prepare the Canvas/);
});

test('Skill registry reports version and MCP compatibility failures', () => {
  const registry = createBeatDesignSkillRegistry({
    definitions: [definition()],
    beatDesignVersion: '0.2.2',
    availableMcpTools: [],
  });

  const [descriptor] = registry.list();
  assert.equal(descriptor.compatible, false);
  assert.deepEqual(descriptor.incompatibilities, [
    'Requires BeatDesign 0.2.3 or newer.',
    'Missing MCP tools: bdesign_canvas_apply.',
  ]);
});

test('Skill registry rejects duplicate ids', () => {
  assert.throws(
    () =>
      createBeatDesignSkillRegistry({
        definitions: [definition(), definition()],
        beatDesignVersion: '0.2.3',
        availableMcpTools: ['bdesign_canvas_apply'],
      }),
    /Duplicate BeatDesign Skill id/
  );
});

test('filesystem loader validates directory names and reads fixed Skill files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'beatdesign-skills-'));
  const skillDirectory = resolve(root, 'ugc-director');
  try {
    await mkdir(skillDirectory);
    await writeFile(
      resolve(skillDirectory, 'skill.json'),
      `${JSON.stringify(definition().manifest)}\n`
    );
    await writeFile(
      resolve(skillDirectory, 'SKILL.md'),
      definition().instructions
    );

    const registry = await loadBeatDesignSkillRegistry({
      directory: root,
      beatDesignVersion: '0.2.3',
      availableMcpTools: ['bdesign_canvas_apply'],
    });
    assert.equal(registry.list().length, 1);
    assert.equal(registry.get('ugc-director')?.manifest.title, 'UGC Director');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem loader treats a missing official directory as an empty catalog', async () => {
  const registry = await loadBeatDesignSkillRegistry({
    directory: resolve(tmpdir(), 'beatdesign-skills-directory-does-not-exist'),
    beatDesignVersion: '0.2.3',
    availableMcpTools: [],
  });
  assert.deepEqual(registry.catalog().skills, []);
});
