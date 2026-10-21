import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ locale: 'en-US' });
const headers = { 'x-beatapi-workspace-request': '1' };

async function createProject(request: APIRequestContext, name: string) {
  const response = await request.post('/api/app/projects', { headers, data: { name } });
  expect(response.ok()).toBe(true);
  return (await response.json()).id as string;
}

async function settings(request: APIRequestContext, id: string) {
  return (await (await request.get(`/api/app/projects/${id}`)).json()).settings;
}

async function updateViaMcp(request: APIRequestContext, id: string, revision: number, name: string) {
  const response = await request.post('http://127.0.0.1:3043/mcp', {
    headers: { authorization: 'Bearer e2e-local-only', accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
      name: 'bdesign_project_update', arguments: { projectId: id, expectedRevision: revision, patch: { name } },
    } },
  });
  expect(response.ok()).toBe(true);
  const text = await response.text();
  const data = JSON.parse(text.startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data: '))!.slice(6));
  expect(data.error).toBeUndefined();
  expect(data.result.isError).not.toBe(true);
  expect((await settings(request, id)).name).toBe(name);
}

test('project settings upload a persistent cover and share revisions with MCP', async ({ page, request }) => {
  const serverModuleRequests: string[] = [];
  page.on('request', (req) => {
    if (/\/src\/(core\/db\/|modules\/config\/|core\/adapters\/beatapi-adapter)/.test(req.url())) serverModuleRequests.push(req.url());
  });
  const id = await createProject(request, 'Settings QA');
  await page.goto(`/canvas/${id}`);
  await page.getByRole('button', { name: 'Project settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Project name', { exact: true })).toHaveValue('Settings QA');
  await dialog.getByLabel('Project name', { exact: true }).fill('Cover QA');
  await dialog.getByLabel('Description', { exact: false }).fill('A local project cover');
  await dialog.locator('input[type=file]').setInputFiles('public/logo.png');
  await expect(dialog.getByText('Custom cover', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = await settings(request, id);
  expect(saved.coverMode).toBe('manual');
  expect(saved.description).toBe('A local project cover');
  const imported = await request.post(`/api/app/projects/${id}/assets`, {
    headers, multipart: { file: { name: 'later.png', mimeType: 'image/png', buffer: await readFile('public/logo.png') } },
  });
  expect(imported.ok()).toBe(true);
  expect((await settings(request, id)).coverAssetId).toBe(saved.coverAssetId);
  await updateViaMcp(request, id, saved.settingsRevision, 'Agent renamed project');
  await expect(page.getByRole('textbox', { name: 'Workspace name', exact: true })).toHaveValue('Agent renamed project');
  await page.getByRole('button', { name: 'Project settings', exact: true }).click();
  await expect(dialog.getByLabel('Project name', { exact: true })).toHaveValue('Agent renamed project');
  await dialog.getByRole('button', { name: 'Use automatic cover', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await settings(request, id)).coverMode).toBe('auto');
  await page.goto('/projects');
  const card = page.locator('article').filter({ hasText: 'Agent renamed project' });
  await expect(card).toContainText('A local project cover');
  await expect(card.locator('img')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole('button', { name: 'Project settings', exact: true }).click();
  await expect(dialog.getByLabel('Project name', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/project-settings-mobile.png' });
  expect(serverModuleRequests).toEqual([]);
});

test('stale settings saves keep local edits and leave the MCP change intact', async ({ page, request }) => {
  const id = await createProject(request, 'Conflict QA');
  await page.goto(`/canvas/${id}`);
  await page.getByRole('button', { name: 'Project settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Project name', { exact: true })).toHaveValue('Conflict QA');
  const before = await settings(request, id);
  await dialog.getByLabel('Description', { exact: false }).fill('Keep this draft');
  await updateViaMcp(request, id, before.settingsRevision, 'Concurrent agent edit');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Project settings changed elsewhere');
  await expect(dialog.getByLabel('Description', { exact: false })).toHaveValue('Keep this draft');
  expect((await settings(request, id)).name).toBe('Concurrent agent edit');
  await page.screenshot({ path: 'test-results/project-settings-conflict.png' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Workspace name', exact: true });
  await expect(title).toHaveValue('Concurrent agent edit');
  await title.fill('Unsubmitted local title');
  const current = await settings(request, id);
  const refreshed = page.waitForResponse(async (response) => {
    if (response.request().method() !== 'GET' || !response.url().endsWith(`/api/app/projects/${id}`)) return false;
    return (await response.json()).settings.name === 'Another agent edit';
  });
  await updateViaMcp(request, id, current.settingsRevision, 'Another agent edit');
  await refreshed;
  await expect(title).toHaveValue('Unsubmitted local title');
});

test('home does not overflow narrow screens', async ({ page }) => {
  for (const width of [390, 648]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width);
  }
});

test('undo and redo persist an explicitly empty Canvas across reload', async ({ page, request }) => {
  const id = await createProject(request, 'Empty undo QA');
  await page.goto(`/canvas/${id}`);
  await expect(page.getByRole('button', { name: 'Project settings', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Generation node', exact: true }).click();
  const cards = async () => (await (await request.get(`/api/app/projects/${id}/snapshot`)).json()).document.cards;
  await expect.poll(async () => (await cards()).length).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await cards()).length).toBe(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await cards()).length).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await cards()).length).toBe(0);
  await page.reload();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
});
