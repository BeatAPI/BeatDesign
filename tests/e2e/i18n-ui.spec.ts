import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';

const headers = { 'x-beatapi-workspace-request': '1' };

async function checkSurface(page: Page, info: TestInfo, locale: string, name: string) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()!.width);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/(?:AppShell|Organization|ProjectSettings|Common)\.[a-zA-Z]/);
  if (locale === 'ja') expect(body).not.toMatch(/Project organization|Create folder|Workflow templates|Group contents|Arrange groups/);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
}

for (const locale of ['en', 'zh', 'ja'] as const) {
  for (const width of [1440, 390]) {
    test(`${locale} ${width}px: workspace pages, dialogs and validation stay localized`, async ({ page, context, request }, info) => {
      test.setTimeout(120_000);
      const tree = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'));
      const t = (key: string): string => tree[key] ?? key.split('.').reduce((value, part) => value?.[part], tree);
      const prefix = locale === 'en' ? '' : `/${locale}`;
      await context.addCookies([{ name: 'PARAGLIDE_LOCALE', value: locale, domain: '127.0.0.1', path: '/' }]);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let generations = 0;
      page.on('request', (req) => { if (new URL(req.url()).pathname === '/api/effects/generate') generations++; });
      const response = await request.post('/api/app/projects', { headers, data: { name: `UI demo ${locale} ${width}` } });
      expect(response.ok()).toBe(true);
      const { id } = await response.json();

      await page.goto(`${prefix}/`);
      await expect(page.getByRole('heading', { name: t('product.shell.studio'), exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'home');

      await page.goto(`${prefix}/projects`);
      await page.getByRole('button', { name: t('product.history.newProject'), exact: true }).first().click();
      const chooser = page.getByRole('dialog');
      await expect(chooser).toBeVisible();
      await expect(chooser.getByText(t('product.history.createDescription'), { exact: true })).toBeVisible();
      expect(await chooser.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await checkSurface(page, info, locale, 'project-chooser');
      await chooser.getByRole('button', { name: t('Common.close'), exact: true }).click();

      await page.goto(`${prefix}/studio/${id}`);
      await expect(page.locator('textarea').first()).toBeVisible();
      await page.getByRole('button', { name: t('AppShell.studio.messages.modelPickerLabel'), exact: true }).click();
      await expect(page.getByRole('option', { name: 'Qwen Image 2.1', exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'studio-models');
      await page.getByRole('option', { name: 'Qwen Image 2.1', exact: true }).click();
      await page.locator('textarea').first().fill('A geometric orange cube');
      await page.getByRole('button', { name: t('AppShell.studio.canvas.composer.generate'), exact: true }).last().click();
      await expect(page.getByText(t('AppShell.studio.messages.providerKeyRequired'), { exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'studio-validation');

      await page.getByRole('button', { name: t('AppShell.header.apiConfig.triggerLabel'), exact: true }).click();
      const connections = page.getByRole('dialog');
      await expect(connections.getByLabel(t('AppShell.header.apiConfig.keyLabel'), { exact: true })).toBeVisible();
      await connections.getByRole('button', { name: t('AppShell.header.apiConfig.storageTab'), exact: true }).click();
      await connections.getByRole('button', { name: t('AppShell.header.apiConfig.storage.customTitle'), exact: true }).click();
      await expect(connections.getByLabel(t('AppShell.header.apiConfig.storage.bucketLabel'), { exact: true })).toBeVisible();
      expect(await connections.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await checkSurface(page, info, locale, 'storage-settings');
      await connections.getByRole('button', { name: t('Common.close'), exact: true }).click();

      await page.getByRole('button', { name: t('ProjectSettings.title'), exact: true }).click();
      const settings = page.getByRole('dialog');
      await expect(settings.getByLabel(t('ProjectSettings.name'), { exact: true })).toHaveValue(`UI demo ${locale} ${width}`);
      const project = await (await request.get(`/api/app/projects/${id}`)).json();
      const date = new Date(project.settings.createdAt).toLocaleDateString(locale);
      await expect(settings.getByText(date, { exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'project-settings');
      await settings.getByRole('button', { name: t('Common.close'), exact: true }).click();

      await page.goto(`${prefix}/assets/${id}`);
      await expect(page.getByRole('heading', { name: t('AppShell.header.projectAssets.title'), exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'assets');
      if (width < 640) await page.getByRole('button', { name: t('Organization.title'), exact: true }).click();
      else await page.getByTestId('project-organization-panel').locator(':scope > summary').click();
      await expect(page.getByLabel(t('Organization.folderName'), { exact: true })).toBeVisible();
      await page.getByRole('button', { name: t('Organization.elements'), exact: true }).click();
      await expect(page.getByLabel(t('Organization.kind'), { exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'asset-elements');
      if (width < 640) await page.getByRole('button', { name: t('Organization.closePanel'), exact: true }).click();

      await page.goto(`${prefix}/canvas/${id}`);
      const panel = page.getByTestId('canvas-organization-panel');
      await panel.locator(':scope > summary').click();
      await expect(panel.getByLabel(t('Organization.groupName'), { exact: true })).toBeVisible();
      await expect(panel.getByText(t('Organization.templates'), { exact: true })).toBeVisible();
      expect(await panel.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await checkSurface(page, info, locale, 'canvas-organization');
      const templates = page.getByTestId('workflow-template-panel');
      await templates.locator(':scope > summary').click();
      await expect(templates.getByText(t('Organization.templateLocalOnly'), { exact: true })).toBeVisible();
      const templateName = templates.getByLabel(t('Organization.templateName'), { exact: true });
      await templateName.scrollIntoViewIfNeeded();
      expect(await templateName.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return top === node || node.contains(top);
      })).toBe(true);
      await checkSurface(page, info, locale, 'workflow-templates');

      await page.goto(`${prefix}/editor/${id}`);
      await expect(page.getByText(t('AppShell.editor.empty.title'), { exact: true })).toBeVisible();
      await checkSurface(page, info, locale, 'editor');
      await page.locator('input[type=file]').first().setInputFiles('tests/fixtures/tiny-black.mp4');
      await expect(page.getByRole('button', { name: /^tiny-black\.mp4 \d/ })).toBeVisible();
      await checkSurface(page, info, locale, 'editor-media');
      if (width > 640) {
        await page.getByRole('button', { name: t('AppShell.editor.actions.redo'), exact: true }).click();
        await expect(page.getByText(t('AppShell.editor.redo.billingNotice'), { exact: true })).toBeVisible();
        await checkSurface(page, info, locale, 'editor-redo');
        await page.getByRole('button', { name: t('AppShell.editor.redo.close'), exact: true }).click();
      }

      for (const route of ['privacy-policy', 'terms-of-service']) {
        await page.goto(`${prefix}/${route}`);
        await expect(page.locator('h1').first()).toBeVisible();
        await checkSurface(page, info, locale, route);
      }
      expect(generations).toBe(0);
      expect(errors).toEqual([]);
    });
  }
}
