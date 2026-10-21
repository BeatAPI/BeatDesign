import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({
  locale: 'en-US',
  ...(process.platform === 'win32'
    ? { launchOptions: { channel: 'chrome' } }
    : {}),
});
const headers = { 'x-beatapi-workspace-request': '1' };
let rpcId = 0;
async function mcp(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown>
) {
  const response = await request.post('http://127.0.0.1:3043/mcp', {
    headers: {
      authorization: 'Bearer e2e-local-only',
      accept: 'application/json, text/event-stream',
    },
    data: {
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  });
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  const data = JSON.parse(
    text.startsWith('{')
      ? text
      : text
          .split('\n')
          .find((line) => line.startsWith('data: '))!
          .slice(6)
  );
  expect(data.error).toBeUndefined();
  expect(data.result?.isError, JSON.stringify(data)).not.toBe(true);
  return data.result.structuredContent.result;
}
async function fixture(request: APIRequestContext) {
  const { projects } = await (await request.get('/api/app/projects')).json();
  const source = projects.find(
    (project: { name: string }) =>
      project.name === 'Canvas organization · 8 shot synthetic preview'
  );
  const target = projects.find(
    (project: { name: string }) =>
      project.name === 'Template binding · isolated target'
  );
  expect(source).toBeTruthy();
  expect(target).toBeTruthy();
  return { id: source.id as string, targetId: target.id as string };
}

test('140 saved records render as 12 entries, keyboard expansion persists and old take usage stays exact', async ({
  page,
  request,
}) => {
  const { id } = await fixture(request);
  const before = await (
    await request.get(`/api/app/projects/${id}/snapshot`)
  ).json();
  expect(before.document.cards).toHaveLength(140);
  expect(Object.keys(before.document.organization.groups)).toHaveLength(8);
  await page.goto(`/canvas/${id}`);
  await page
    .getByRole('button', { name: 'Fit graph to view', exact: true })
    .click();
  await expect(page.locator('.react-flow__node')).toHaveCount(12);
  const group = page.locator('.react-flow__node[data-id="shot-1"]');
  const toggle = group.getByRole('button').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/app/projects/${id}/snapshot`)).json())
          .document.organization.groups['shot-1'].collapsed
    )
    .toBe(false);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.focus();
  await toggle.press('Enter');
  await expect(page.locator('.react-flow__node')).toHaveCount(12);
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/app/projects/${id}/snapshot`)).json())
          .document.organization.groups['shot-1'].collapsed
    )
    .toBe(true);
  const organizationPanel = page.getByTestId('canvas-organization-panel');
  await organizationPanel.locator('summary').first().click();
  const showHistory = organizationPanel.getByLabel('Show all versions', {
    exact: true,
  });
  await showHistory.click();
  await expect(showHistory).toBeChecked();
  const history = page.getByRole('region', {
    name: 'All generation versions',
    exact: true,
  });
  await expect(history).toBeVisible();
  await expect(
    history.getByRole('button', { name: 'View result', exact: true })
  ).toHaveCount(112);
  await expect(
    history.getByText('Displayed result', { exact: true })
  ).toHaveCount(16);
  await history
    .getByRole('button', { name: 'View result', exact: true })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button').click();
  await history.getByRole('button', { name: 'Collapse', exact: true }).click();
  await expect(history).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(12);
  const after = await (
    await request.get(`/api/app/projects/${id}/snapshot`)
  ).json();
  expect(after.document.cards).toEqual(before.document.cards);
  expect(after.document.frames).toEqual(before.document.frames);
  const usage = await (
    await request.get(`/api/app/projects/${id}/timeline-usage`)
  ).json();
  expect(usage.clips).toHaveLength(8);
  expect(
    usage.clips.some((clip: { sourceIn: number }) => clip.sourceIn === 0.1)
  ).toBe(true);
  expect(
    usage.clips.some((clip: { takeId: string | null }) =>
      clip.takeId?.endsWith('old-take')
    )
  ).toBe(true);
  await organizationPanel.locator('summary').first().click();
  await page
    .locator('.react-flow__pane')
    .click({ position: { x: 1400, y: 600 } });
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Shared character', exact: true })
        .evaluate(
          (node) =>
            node instanceof HTMLImageElement &&
            node.complete &&
            node.naturalWidth > 0
        )
    )
    .toBe(true);
  for (const supportId of ['support-character', 'support-location']) {
    // Cached images may finish loading before React's passive effects run.
    // A decoded image must not keep the pending-preview status overlay.
    await expect(
      page
        .locator(`.react-flow__node[data-id="${supportId}"]`)
        .getByRole('status')
    ).toHaveCount(0);
  }
  await page.screenshot({ path: 'test-results/organization-overview-en.png' });
});

test('Assets folders round trip through keyboard UI, MCP changes preserve dirty input and pagination passes 500', async ({
  page,
  request,
}) => {
  const { id } = await fixture(request);
  const blockedRequests: string[] = [];
  page.on('request', (req) => {
    if (/\/api\/(?:effects\/generate|storage\/upload)/.test(req.url()))
      blockedRequests.push(req.url());
  });
  await page.goto(`/assets/${id}`);
  const panel = page.getByTestId('project-organization-panel');
  await panel.locator('summary').focus();
  await panel.locator('summary').press('Enter');
  await expect(panel.getByLabel('Folder name', { exact: true })).toBeVisible();
  const name = `Keyboard folder ${Date.now()}`;
  await panel.getByLabel('Folder name', { exact: true }).fill(name);
  await panel
    .getByRole('button', { name: 'Create folder', exact: true })
    .focus();
  await panel
    .getByRole('button', { name: 'Create folder', exact: true })
    .press('Enter');
  await expect
    .poll(async () =>
      Object.values(
        (
          await (
            await request.get(`/api/app/projects/${id}/organization`)
          ).json()
        ).document.folders
      ).some((folder: any) => folder.name === name)
    )
    .toBe(true);
  await page.reload();
  await panel.locator('summary').click();
  await expect(
    panel
      .getByLabel('Folder', { exact: true })
      .locator('option')
      .filter({ hasText: name })
  ).toHaveCount(1);
  await panel
    .getByLabel('Folder name', { exact: true })
    .fill('Unsaved local text');
  const state = await (
    await request.get(`/api/app/projects/${id}/organization`)
  ).json();
  const commandId = crypto.randomUUID();
  const changed = await mcp(request, 'bdesign_organization_apply', {
    projectId: id,
    commandId,
    idempotencyKey: commandId,
    expectedRevision: state.revision,
    operations: [
      {
        type: 'create_folder',
        folderId: commandId,
        name: 'Agent created folder',
        parentId: null,
      },
    ],
  });
  expect(changed.ok).toBe(true);
  await expect(
    panel
      .getByText(
        'The project changed. Review the latest version before saving.',
        { exact: true }
      )
      .first()
  ).toBeVisible();
  await expect(panel.getByLabel('Folder name', { exact: true })).toHaveValue(
    'Unsaved local text'
  );
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({
      scope: 'current',
      folderId: 'reference-library',
      limit: '100',
    });
    if (cursor) params.set('cursor', cursor);
    const pageResult = await (
      await request.get(`/api/app/projects/${id}/organization-assets?${params}`)
    ).json();
    for (const asset of pageResult.assets) {
      expect(seen.has(asset.id)).toBe(false);
      seen.add(asset.id);
    }
    cursor = pageResult.nextCursor;
  } while (cursor);
  expect(seen.size).toBe(502);
  expect(blockedRequests).toEqual([]);
  await page.screenshot({
    path: 'test-results/organization-assets-conflict-en.png',
  });
});

test('Chinese organization labels and keyboard creation persist without touching media', async ({
  page,
  request,
  context,
}) => {
  const { id } = await fixture(request);
  await context.addCookies([
    { name: 'PARAGLIDE_LOCALE', value: 'zh', domain: '127.0.0.1', path: '/' },
  ]);
  const before = await (
    await request.get(`/api/app/projects/${id}/snapshot`)
  ).json();
  await page.goto(`/zh/assets/${id}`);
  const panel = page.getByTestId('project-organization-panel');
  await expect(panel.locator('summary')).toHaveText('项目组织');
  await panel.locator('summary').focus();
  await panel.locator('summary').press('Enter');
  await panel.getByLabel('文件夹名称', { exact: true }).fill('中文键盘目录');
  await panel.getByRole('button', { name: '新建文件夹', exact: true }).focus();
  await panel
    .getByRole('button', { name: '新建文件夹', exact: true })
    .press('Enter');
  await expect
    .poll(async () =>
      Object.values(
        (
          await (
            await request.get(`/api/app/projects/${id}/organization`)
          ).json()
        ).document.folders
      ).some((folder: any) => folder.name === '中文键盘目录')
    )
    .toBe(true);
  await panel.getByRole('button', { name: '共享参考', exact: true }).click();
  await expect(
    panel.getByLabel('共享参考', { exact: true }).locator('option')
  ).toContainText(['新建共享参考', 'Synthetic character']);
  const after = await (
    await request.get(`/api/app/projects/${id}/snapshot`)
  ).json();
  expect(after.document).toEqual(before.document);
  await page.screenshot({ path: 'test-results/organization-elements-zh.png' });
});

test('MCP-saved workflow appears in Canvas and UI inserts an unbound draft without generating', async ({
  page,
  request,
}) => {
  const { id, targetId } = await fixture(request);
  const preview = await mcp(request, 'bdesign_workflow_template_preview', {
    projectId: id,
    preview: { selectedCardIds: ['shot-1-script', 'shot-1-image'] },
  });
  const templateId = crypto.randomUUID();
  const captured = await mcp(request, 'bdesign_workflow_template_apply', {
    projectId: id,
    expectedRevision: 0,
    commandId: templateId,
    idempotencyKey: templateId,
    command: {
      type: 'workflow.template.capture',
      templateId,
      name: 'E2E explicit workflow',
      selectedCardIds: ['shot-1-script', 'shot-1-image'],
      sourceCanvasRevision: preview.sourceCanvasRevision,
      definitionDigest: preview.definitionDigest,
    },
  });
  expect(captured.ok).toBe(true);
  const generated: string[] = [];
  page.on('request', (req) => {
    if (/\/api\/(?:effects\/generate|storage\/upload)/.test(req.url()))
      generated.push(req.url());
  });
  await page.goto(`/canvas/${targetId}`);
  const organization = page.getByTestId('canvas-organization-panel');
  await organization.locator('summary').first().click();
  const templates = page.getByTestId('workflow-template-panel');
  await templates.locator('summary').click();
  await templates
    .locator('section[aria-label="Local template library"] select')
    .first()
    .selectOption(templateId);
  await expect(
    templates.getByTestId('template-definition-preview')
  ).toBeVisible();
  await expect(
    templates.getByText(
      'Unbound required slots block generation. You can bind them later in this draft.'
    )
  ).toBeVisible();
  await templates
    .getByRole('button', { name: 'Insert editable draft', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        Object.keys(
          (
            await (
              await request.get(`/api/app/projects/${targetId}/snapshot`)
            ).json()
          ).document.organization?.templateInstances ?? {}
        ).length
    )
    .toBe(1);
  const snapshot = await (
    await request.get(`/api/app/projects/${targetId}/snapshot`)
  ).json();
  expect(
    snapshot.document.cards.filter(
      (card: { kind: string }) => card.kind === 'generation'
    )
  ).toHaveLength(1);
  expect(
    snapshot.document.cards.every(
      (card: { status: string }) => card.status === 'idle'
    )
  ).toBe(true);
  expect(
    Object.values(snapshot.document.organization.templateInstances).every(
      (instance: any) => Object.keys(instance.slotBindings).length === 0
    )
  ).toBe(true);
  expect(generated).toEqual([]);
  const insertedDraft = snapshot.document.cards.find((card: {kind:string}) => card.kind === 'generation');
  await expect(page.locator(`.react-flow__node[data-id="${insertedDraft.id}"]`)).toBeInViewport();
  await expect(page.locator('[data-text-node="true"]')).toHaveCount(1);
  await page.screenshot({
    path: 'test-results/organization-template-draft-en.png',
  });
});

for (const locale of ['en', 'zh'] as const) {
  test(`${locale}: keyboard groups, Asset search, fixed reference review and template save/insert stay local`, async ({
    page,
    request,
    context,
  }) => {
    const t = (
      JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')) as {
        Organization: Record<string, string>;
      }
    ).Organization;
    await context.addCookies([
      {
        name: 'PARAGLIDE_LOCALE',
        value: locale,
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    const created = await request.post('/api/app/projects', {
      headers,
      data: { name: `Bilingual organization ${locale}` },
    });
    expect(created.ok()).toBe(true);
    const id = (await created.json()).id as string;
    const assets: { id: string; publicUrl: string }[] = [];
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR42mPQ96slCTGMahgUGgD8sYyh+gdn4AAAAABJRU5ErkJggg==',
      'base64'
    );
    for (const version of [1, 2]) {
      const uploaded = await request.post(`/api/app/projects/${id}/assets`, {
        headers,
        multipart: {
          file: {
            name: `Locale-${locale}-reference-${version}.png`,
            mimeType: 'image/png',
            buffer: pixel,
          },
        },
      });
      expect(uploaded.ok()).toBe(true);
      assets.push((await uploaded.json()).asset);
    }
    const prepared = await mcp(request, 'bdesign_organization_apply', {
      projectId: id,
      commandId: `prepare-${locale}`,
      idempotencyKey: `prepare-${locale}`,
      expectedRevision: 0,
      operations: [
        {
          type: 'create_element',
          elementId: 'hero',
          name: `Hero ${locale}`,
          kind: 'character',
          description: 'Synthetic reference',
          versionId: 'v1',
          assetId: assets[0].id,
        },
        {
          type: 'add_element_version',
          elementId: 'hero',
          versionId: 'v2',
          assetId: assets[1].id,
        },
      ],
    });
    expect(prepared.ok).toBe(true);
    const seeded = await mcp(request, 'bdesign_canvas_apply', {
      projectId: id,
      commandId: `canvas-${locale}`,
      idempotencyKey: `canvas-${locale}`,
      expectedRevision: 1,
      operations: [
        {
          type: 'upsert_card',
          card: {
            id: 'locale-source',
            kind: 'asset',
            type: 'image',
            assetId: assets[0].id,
            name: 'Synthetic source',
            aspectRatio: '16:9',
          },
          frame: { x: 180, y: 180, w: 320, h: 180 },
        },
        {
          type: 'upsert_card',
          card: {
            id: 'locale-generation',
            kind: 'generation',
            type: 'image',
            name: 'Locale candidate',
            modelId: 'gpt-image-2.5-flare',
            prompt: 'Synthetic local candidate',
            referenceCardIds: ['locale-source'],
          },
          frame: { x: 560, y: 180, w: 380, h: 380 },
        },
        {
          type: 'create_group',
          groupId: 'locale-shot',
          name: 'Locale shot',
          role: 'shot',
          memberCardIds: ['locale-source', 'locale-generation'],
          collapsed: true,
          summaryFrame: { x: 180, y: 180, w: 340, h: 210 },
          expandedFrame: { x: 120, y: 120, w: 900, h: 520 },
        },
      ],
    });
    expect(seeded.ok).toBe(true);
    const prefix = locale === 'zh' ? '/zh' : '';
    const jobs: string[] = [];
    page.on('request', (req) => {
      if (/\/api\/(?:effects\/generate|storage\/upload)/.test(req.url()))
        jobs.push(req.url());
    });
    await page.goto(`${prefix}/canvas/${id}`);
    const group = page.locator('.react-flow__node[data-id="locale-shot"]');
    const toggle = group.getByRole('button').first();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.focus();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page
      .getByRole('button', {
        name: locale === 'zh' ? '适配全部节点' : 'Fit graph to view',
        exact: true,
      })
      .click();
    const generation = page.locator(
      '.react-flow__node[data-id="locale-generation"]'
    );
    await generation.focus();
    await generation.press('Enter');
    const canvasPanel = page.getByTestId('canvas-organization-panel');
    await canvasPanel.locator('summary').first().click();
    await canvasPanel
      .getByRole('combobox', { name: t.element, exact: true })
      .selectOption('hero');
    await canvasPanel
      .getByRole('combobox', { name: t.versions, exact: true })
      .selectOption('v1');
    await expect(
      canvasPanel.getByRole('button', { name: t.bindElement, exact: true })
    ).toBeEnabled();
    await canvasPanel
      .getByRole('button', { name: t.bindElement, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          Object.keys(
            (
              await (
                await request.get(`/api/app/projects/${id}/snapshot`)
              ).json()
            ).document.organization?.elementBindings ?? {}
          ).length
      )
      .toBe(1);
    await page.goto(`${prefix}/assets/${id}`);
    const assetsPanel = page.getByTestId('project-organization-panel');
    await assetsPanel.locator('summary').click();
    await assetsPanel
      .getByLabel(t.search, { exact: true })
      .fill(`Locale-${locale}-reference-2`);
    await assetsPanel
      .getByRole('button', { name: t.search, exact: true })
      .click();
    await expect(
      assetsPanel
        .getByRole('list', { name: t.assets, exact: true })
        .locator('li')
    ).toHaveCount(1);
    await assetsPanel
      .getByRole('button', { name: t.elements, exact: true })
      .click();
    await assetsPanel
      .getByRole('combobox', { name: t.element, exact: true })
      .selectOption('hero');
    await assetsPanel
      .getByRole('button', { name: t.setCurrent, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/app/projects/${id}/organization`)
            ).json()
          ).document.elements.hero.currentVersionId
      )
      .toBe('v2');
    const withOldBinding = await (
      await request.get(`/api/app/projects/${id}/snapshot`)
    ).json();
    expect(
      Object.values(withOldBinding.document.organization.elementBindings).every(
        (binding: any) =>
          binding.versionId === 'v1' && binding.assetId === assets[0].id
      )
    ).toBe(true);
    await page.goto(`${prefix}/canvas/${id}`);
    await canvasPanel.locator('summary').first().click();
    await expect(
      canvasPanel.getByText(t.needsReview, { exact: true })
    ).toBeVisible();
    await canvasPanel
      .getByRole('button', { name: t.keepVersion, exact: true })
      .click();
    await expect(
      canvasPanel.getByText(t.needsReview, { exact: true })
    ).toHaveCount(0);
    await toggle.focus();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page
      .getByRole('button', {
        name: locale === 'zh' ? '适配全部节点' : 'Fit graph to view',
        exact: true,
      })
      .click();
    await generation.focus();
    await generation.press('Enter');
    const templates = page.getByTestId('workflow-template-panel');
    await templates.locator('summary').click();
    const templateName = `Local workflow ${locale}`;
    await templates
      .getByLabel(t.templateName, { exact: true })
      .fill(templateName);
    await templates
      .getByRole('button', { name: t.templatePreviewSelection, exact: true })
      .click();
    await expect(
      templates.getByTestId('template-definition-preview')
    ).toBeVisible();
    await templates
      .getByRole('button', { name: t.templateSave, exact: true })
      .click();
    const library = templates
      .locator(`section[aria-label="${t.templateLibrary}"] select`)
      .first();
    await expect(
      library.locator('option').filter({ hasText: templateName })
    ).toHaveCount(1);
    await library.selectOption({ label: templateName });
    await expect(
      templates.getByText(t.templateDraftUnbound, { exact: true })
    ).toBeVisible();
    await templates
      .getByRole('button', { name: t.templateInsert, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          Object.keys(
            (
              await (
                await request.get(`/api/app/projects/${id}/snapshot`)
              ).json()
            ).document.organization?.templateInstances ?? {}
          ).length
      )
      .toBe(1);
    const final = await (
      await request.get(`/api/app/projects/${id}/snapshot`)
    ).json();
    expect(
      Object.values(final.document.organization.elementBindings).every(
        (binding: any) => binding.versionId === 'v1'
      )
    ).toBe(true);
    expect(
      (
        await (
          await request.get(`/api/app/projects/${id}/timeline-usage`)
        ).json()
      ).clips
    ).toEqual([]);
    expect(
      await mcp(request, 'bdesign_generation_history', { projectId: id })
    ).toEqual([]);
    expect(jobs).toEqual([]);
    await page.screenshot({
      path: `test-results/organization-bilingual-${locale}.png`,
    });
  });
}

for (const locale of ['en', 'zh'] as const) {
  test(`${locale}: mobile organization drawer traps focus, closes with Escape, and preserves the folder form`, async ({
    page,
    request,
    context,
  }) => {
    const t = (
      JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')) as {
        Organization: Record<string, string>;
      }
    ).Organization;
    await context.addCookies([
      {
        name: 'PARAGLIDE_LOCALE',
        value: locale,
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await request.post('/api/app/projects', {
      headers,
      data: { name: 'Mobile organization drawer QA' },
    });
    expect(response.ok()).toBeTruthy();
    const { id } = await response.json();
    await page.goto(`${locale === 'zh' ? '/zh' : ''}/assets/${id}`);
    const trigger = page.getByRole('button', {
      name: t.title,
      exact: true,
    });
    await trigger.focus();
    await trigger.press('Enter');
    const drawer = page.getByTestId('project-organization-drawer');
    await expect(drawer).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: t.title, exact: true })
    ).toBeVisible();
    const folderName = drawer.getByLabel(t.folderName, { exact: true });
    const name = `Mobile folder ${Date.now()}`;
    await folderName.fill(name);
    for (const key of ['Tab', 'Shift+Tab', ...Array(16).fill('Tab')]) {
      await page.keyboard.press(key);
      await expect
        .poll(() =>
          drawer.evaluate((node) => node.contains(document.activeElement))
        )
        .toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');
    await expect(folderName).toHaveValue(name);
    await drawer
      .getByRole('button', { name: t.createFolder, exact: true })
      .click();
    await expect
      .poll(async () =>
        Object.values(
          (
            await (
              await request.get(`/api/app/projects/${id}/organization`)
            ).json()
          ).document.folders
        ).some((folder: any) => folder.name === name)
      )
      .toBe(true);
    await folderName.fill('Retain this unsaved mobile draft');
    await drawer
      .getByRole('button', { name: t.closePanel, exact: true })
      .click();
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');
    await expect(folderName).toHaveValue('Retain this unsaved mobile draft');
    await expect(drawer).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: `test-results/organization-mobile-drawer-${locale}.png`,
      animations: 'disabled',
    });
  });
}

for (const locale of ['en', 'zh'] as const) {
  test(`${locale}: multiple group containers arrange contents and groups without overlaps, preserve history, undo and reload`, async ({
    page,
    request,
    context,
  }) => {
    const t = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'))
      .Organization as Record<string, string>;
    await context.addCookies([
      {
        name: 'PARAGLIDE_LOCALE',
        value: locale,
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    const { id } = await fixture(request);
    const snapshot = async () =>
      await (await request.get(`/api/app/projects/${id}/snapshot`)).json();
    const before = await snapshot();
    const usageBefore = await (
      await request.get(`/api/app/projects/${id}/timeline-usage`)
    ).json();
    const jobs: string[] = [];
    page.on('request', (req) => {
      if (
        req.method() === 'POST' &&
        /preflight|submit|upload-intent/.test(req.url())
      )
        jobs.push(req.url());
    });
    await page.goto(`${locale === 'zh' ? '/zh' : ''}/canvas/${id}`);
    const panel = page.getByTestId('canvas-organization-panel');
    await panel.locator('summary').first().click();
    await panel
      .getByRole('button', { name: t.expandArrangeAll, exact: true })
      .click();
    await expect
      .poll(async () =>
        Object.values((await snapshot()).document.organization.groups).every(
          (group: any) => !group.collapsed && group.expandedFrame.h < 1000
        )
      )
      .toBe(true);
    await panel.locator('summary').first().click();
    const fit = page.getByRole('button', {
      name: locale === 'zh' ? '适配全部节点' : 'Fit graph to view',
      exact: true,
    });
    await fit.click();
    const groupElements = page.locator('[data-organization-group]');
    await expect(groupElements).toHaveCount(8);
    // Read all geometry in one browser frame: viewport fitting can otherwise
    // virtualize a Take button between separate boundingBox round trips.
    const boxes = await groupElements.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = (node: Element) => {
          const r = node.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const r = element.getBoundingClientRect();
        const id = element.getAttribute('data-organization-group')!;
        return {
          id,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          header: rect(element.querySelector('[role="group"]')!),
          members: ['script', 'image', 'motion'].map((suffix) => {
            const member = document.querySelector(
              `[data-card-id="${id}-${suffix}"]`
            )!;
            return {
              ...rect(member),
              takes: Array.from(
                member.querySelectorAll('button[aria-label^="Take "]')
              ).map(rect),
            };
          }),
        };
      })
    );
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      for (const other of boxes.slice(i + 1))
        expect(
          box.x + box.w <= other.x + 1 ||
            other.x + other.w <= box.x + 1 ||
            box.y + box.h <= other.y + 1 ||
            other.y + other.h <= box.y + 1
        ).toBe(true);
      for (const member of box.members) {
        expect(member.w).toBeGreaterThan(0);
        expect(member.x).toBeGreaterThanOrEqual(box.x);
        expect(member.y).toBeGreaterThanOrEqual(
          box.header.y + box.header.h - 1
        );
        expect(member.x + member.w).toBeLessThanOrEqual(box.x + box.w + 1);
        expect(member.y + member.h).toBeLessThanOrEqual(box.y + box.h + 1);
        for (const take of member.takes) {
          expect(take.w).toBeGreaterThan(0);
          expect(take.x + take.w).toBeLessThanOrEqual(box.x + box.w + 1);
          expect(take.y + take.h).toBeLessThanOrEqual(box.y + box.h + 1);
        }
      }
    }
    await page.screenshot({
      path: `test-results/group-layout-overview-${locale}.png`,
    });
    const arranged = await snapshot();
    const first = page.locator('[data-organization-group="shot-1"]');
    await first
      .getByRole('button', { name: t.layout_column, exact: true })
      .click();
    await expect
      .poll(async () => JSON.stringify((await snapshot()).document.frames))
      .not.toBe(JSON.stringify(arranged.document.frames));
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => JSON.stringify((await snapshot()).document.frames))
      .toBe(JSON.stringify(arranged.document.frames));
    await panel.locator('summary').first().click();
    await panel
      .getByTestId('group-settings-shot-1')
      .getByRole('checkbox')
      .check();
    await panel
      .getByTestId('group-settings-shot-2')
      .getByRole('checkbox')
      .check();
    await panel
      .locator('fieldset')
      .getByRole('button', { name: t.layout_column, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await snapshot()).document.organization.groups['shot-2']
            .expandedFrame.x
      )
      .not.toBe(
        arranged.document.organization.groups['shot-2'].expandedFrame.x
      );
    const selectedOnly = await snapshot();
    for (let index = 3; index <= 8; index++) {
      const groupId = `shot-${index}`;
      expect(selectedOnly.document.organization.groups[groupId]).toEqual(
        arranged.document.organization.groups[groupId]
      );
      for (const memberId of arranged.document.organization.groups[groupId]
        .memberCardIds)
        expect(selectedOnly.document.frames[memberId]).toEqual(
          arranged.document.frames[memberId]
        );
    }
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => JSON.stringify((await snapshot()).document.frames))
      .toBe(JSON.stringify(arranged.document.frames));
    await panel.locator('summary').first().click();
    await page.reload();
    await fit.click();
    await expect(groupElements).toHaveCount(8);
    const dragBox = await first.boundingBox();
    const dragPoint = {
      x: dragBox!.x + dragBox!.width / 2,
      y: dragBox!.y + dragBox!.height - 4,
    };
    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x + 36, dragPoint.y + 24, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => (await snapshot()).document.frames['shot-1-script'].x)
      .not.toBe(arranged.document.frames['shot-1-script'].x);
    const moved = await snapshot();
    const dx =
      moved.document.frames['shot-1-script'].x -
      arranged.document.frames['shot-1-script'].x;
    const dy =
      moved.document.frames['shot-1-script'].y -
      arranged.document.frames['shot-1-script'].y;
    for (const memberId of arranged.document.organization.groups['shot-1']
      .memberCardIds) {
      expect(
        moved.document.frames[memberId].x - arranged.document.frames[memberId].x
      ).toBeCloseTo(dx);
      expect(
        moved.document.frames[memberId].y - arranged.document.frames[memberId].y
      ).toBeCloseTo(dy);
    }
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => JSON.stringify((await snapshot()).document.frames))
      .toBe(JSON.stringify(arranged.document.frames));
    const after = await snapshot();
    expect(after.document.frames).toEqual(arranged.document.frames);
    expect(after.document.cards).toEqual(before.document.cards);
    expect(
      (
        await (
          await request.get(`/api/app/projects/${id}/timeline-usage`)
        ).json()
      ).clips
    ).toEqual(usageBefore.clips);
    expect(
      await mcp(request, 'bdesign_generation_history', { projectId: id })
    ).toEqual([]);
    expect(jobs).toEqual([]);
  });
}
