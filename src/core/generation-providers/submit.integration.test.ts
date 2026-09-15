import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const directory = await mkdtemp(join(tmpdir(), 'beatdesign-generation-test-'));
process.env.BEATDESIGN_DATA_DIR = directory;
execFileSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], { env: process.env, stdio: 'pipe' });
after(async () => { await rm(directory, { recursive: true, force: true }); });

const { createProject } = await import('@/core/projects/projects');
const { createAssetFirstGenerationIntent, preflightAssetFirstGeneration, submitAssetFirstGeneration } = await import('./submit');
const { getActiveGenerationProvider } = await import('./registry');
const { BaseAdapter } = await import('@/core/adapters/base-adapter');
const provider = getActiveGenerationProvider();
const originalConfigured = provider.assertConfigured;
const originalAdapter = provider.createAdapter;
const inputs: unknown[] = [];
provider.assertConfigured = async () => {};
class FixtureAdapter extends BaseAdapter {
  async createGeneration(input: unknown) {
    inputs.push(input);
    return { status: 'failed' as const, error: 'Fixture completed without a remote request.' };
  }
}
provider.createAdapter = (effect) => new FixtureAdapter(effect);
after(() => { provider.assertConfigured = originalConfigured; provider.createAdapter = originalAdapter; });

test('UI and MCP generation requests compile identically through the shared service', async () => {
  const project = await createProject({ name: 'Parity test' });
  const generation = { version: 2, projectId: project.id, modelId: 'nano-banana-pro', mode: 'image', prompt: 'A green sculpture', references: [], parameters: { aspect_ratio: '1:1', wmOutputQuality: '2k' } };
  const intent = await createAssetFirstGenerationIntent(generation);
  await submitAssetFirstGeneration({ generation, generationIntentId: intent, origin: 'ui' });
  await submitAssetFirstGeneration({ generation, origin: 'mcp' });
  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs[0], inputs[1]);
});

test('missing assets and invalid parameters fail before any provider execution or upload', async () => {
  const project = await createProject({ name: 'Validation test' });
  const generation = { version: 2, projectId: project.id, modelId: 'nano-banana-pro', mode: 'image', prompt: 'A green sculpture', references: [], parameters: {} };
  const calls = inputs.length;
  await assert.rejects(() => preflightAssetFirstGeneration({ ...generation, references: [{ assetId: 'missing', role: 'reference' }] }), /does not belong/);
  await assert.rejects(() => preflightAssetFirstGeneration({ ...generation, parameters: { invented_parameter: 'invalid' } }), /Unsupported model parameters/);
  assert.equal(inputs.length, calls);
});
