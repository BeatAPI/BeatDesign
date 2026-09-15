import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';

const headers = { 'x-beatapi-workspace-request': '1' };
let rpcId = 0;
async function mcp(request: APIRequestContext, name: string, args: Record<string, unknown>) {
  const response = await request.post('http://127.0.0.1:3043/mcp', {
    headers: { authorization: 'Bearer e2e-local-only', accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } },
  });
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  const data = JSON.parse(text.startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data: '))!.slice(6));
  expect(data.error).toBeUndefined();
  expect(data.result?.isError).not.toBe(true);
  return data.result;
}

async function project(request: APIRequestContext, name: string) {
  const response = await request.post('/api/app/projects', { headers, data: { name } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).id as string;
}

test('Canvas UI commands and MCP edits share durable state; unchanged polling is lightweight', async ({ page, request }) => {
  const id = await project(request, 'Canvas concurrency QA');
  const initial = { id: 'qa-draft', kind: 'generation', type: 'image', name: 'QA draft', prompt: 'Original prompt', modelId: 'gpt-image-2.5-flare' };
  await mcp(request, 'bdesign_canvas_apply', { projectId: id, operations: [{ type: 'upsert_card', card: initial, frame: { x: 200, y: 160, w: 360, h: 300 } }] });
  const writes: string[] = [];
  const reads: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/commands')) writes.push(req.postData() ?? '');
    if (req.method() === 'GET') reads.push(req.url());
    expect(req.method() === 'PUT' && req.url().includes('/snapshot')).toBe(false);
  });
  await page.goto(`/canvas/${id}`);
  const node = page.locator('.react-flow__node').first();
  await expect(node).toBeVisible();
  // Let initial snapshot hydration and camera fit finish before pointer input.
  await page.waitForTimeout(800);
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 60, { steps: 8 });
  await mcp(request, 'bdesign_canvas_apply', { projectId: id, operations: [{ type: 'upsert_card', card: { ...initial, prompt: 'Agent revised prompt' } }] });
  await page.waitForTimeout(2500);
  await page.mouse.up();
  await expect.poll(() => writes.some((body) => JSON.parse(body).command.type === 'canvas.apply')).toBe(true);
  await expect.poll(async () => (await (await request.get(`/api/app/projects/${id}/snapshot`)).json()).document.cards[0].prompt).toBe('Agent revised prompt');
  await expect.poll(async () => (await (await request.get(`/api/app/projects/${id}/snapshot`)).json()).document.frames['qa-draft'].x).not.toBe(200);
  await node.hover();
  await node.dblclick();
  await expect(page.locator('textarea').first()).toHaveValue('Agent revised prompt');
  reads.length = 0;
  await page.waitForTimeout(4500);
  expect(reads.some((url) => url.endsWith('/revision'))).toBe(true);
  expect(reads.filter((url) => url.endsWith('/snapshot'))).toHaveLength(0);
  await page.screenshot({ path: 'test-results/canvas-desktop.png' });
  await page.reload();
  await expect(node).toBeVisible();
});

test('Local image media renders and exports MP4 without a provider key', async ({ page, request }) => {
  const id = await project(request, 'Local media QA');
  const uploaded = await request.post(`/api/app/projects/${id}/assets`, {
    headers,
    multipart: { file: { name: 'demo-logo.png', mimeType: 'image/png', buffer: await readFile('public/logo.png') } },
  });
  expect(uploaded.ok()).toBe(true);
  const { asset } = await uploaded.json();
  await mcp(request, 'bdesign_editor_edit', { projectId: id, operations: [{
    type: 'add_clip', clipId: 'local-image', assetId: asset.id, sourceUrl: asset.publicUrl,
    name: 'Local demo', sourceType: 'image', sourceDuration: 2,
  }] });
  await page.goto(`/editor/${id}`);
  await expect(page.getByText('Local demo', { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.locator('img').evaluateAll((images) => images.some((image) => image instanceof HTMLImageElement && image.src.includes('/assets/') && image.complete && image.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/editor-media-desktop.png' });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
  const result = await download;
  expect(result.suggestedFilename()).toMatch(/\.mp4$/);
  expect((await stat((await result.path())!)).size).toBeGreaterThan(1000);
});

test('MCP captions appear without reload and local caption edits persist through editor.apply', async ({ page, request }) => {
  const id = await project(request, 'Editor visibility QA');
  await mcp(request, 'bdesign_editor_edit', { projectId: id, operations: [{ type: 'upsert_caption', clipId: 'caption-1', text: 'Original caption', startTime: 0, duration: 4 }] });
  await page.goto(`/editor/${id}`);
  await expect(page.getByText('Original caption', { exact: true }).first()).toBeVisible();
  await mcp(request, 'bdesign_editor_edit', { projectId: id, operations: [{ type: 'upsert_caption', clipId: 'caption-1', text: 'Agent caption', startTime: 0, duration: 3 }] });
  await expect(page.getByText('Agent caption', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Agent caption 3.00s', exact: true }).click();
  const save = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/commands'));
  await page.locator('textarea').first().fill('Locally edited caption');
  const saved = await save;
  expect(saved.request().postDataJSON().command.type).toBe('editor.apply');
  expect((await saved.json()).ok).toBe(true);
  await expect.poll(async () => {
    const state = await (await request.get(`/api/app/projects/${id}/timeline`)).json();
    return state.timeline.document.tracks.flatMap((track: { clips: { text?: string }[] }) => track.clips).find((clip: { text?: string }) => clip.text === 'Locally edited caption')?.text;
  }).toBe('Locally edited caption');
  await page.screenshot({ path: 'test-results/editor-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/editor-mobile.png' });
  await expect(page.getByText('Locally edited caption', { exact: true }).first()).toBeVisible();
});

test('Studio sends asset-first validation and does not submit when provider setup is missing', async ({ page, request }) => {
  const id = await project(request, 'Studio validation QA');
  const submissions: string[] = [];
  page.on('request', (req) => { if (req.url().endsWith('/api/effects/generate')) submissions.push(req.url()); });
  await page.goto(`/studio/${id}`);
  const prompt = page.locator('textarea').first();
  await prompt.fill('A bright green geometric sculpture');
  const validation = page.waitForRequest((req) => req.url().endsWith('/api/effects/precheck'));
  await page.getByRole('button', { name: /generate/i }).last().click();
  const payload = (await validation).postDataJSON();
  expect(payload.generation.projectId).toBe(id);
  expect(payload.generation.modelId).toBeTruthy();
  expect(payload.effectId).toBeUndefined();
  await expect(page.getByText(/key|configured|connect/i).last()).toBeVisible();
  expect(submissions).toHaveLength(0);
});
