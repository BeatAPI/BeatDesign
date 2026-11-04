import { expect, test } from '@playwright/test';

const languages = {
  en: { name: 'English', switch: 'Switch language', studio: 'Studio', canvas: 'Canvas' },
  zh: { name: '中文', switch: '切换语言', studio: '创作台', canvas: '画布' },
  ja: { name: '日本語', switch: '言語を切り替える', studio: 'スタジオ', canvas: 'キャンバス' },
} as const;

for (const locale of ['en', 'zh', 'ja'] as const) {
  test(`${locale}: explicit language choice survives reload, reopened browser state and old locale links`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, locale: locale === 'en' ? 'zh-CN' : 'en-US' });
    try {
      const page = await context.newPage();
      await page.goto('/');
      const initial = locale === 'en' ? languages.zh : languages.en;
      await page.getByRole('button', { name: initial.switch, exact: true }).click();
      await page.getByRole('menuitemradio', { name: languages[locale].name, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);

      // Even choosing the already-visible language explicitly persists it.
      // Remove the initial cookie after hydration to expose the old no-op.
      await context.clearCookies();
      await page.getByRole('button', { name: languages[locale].switch, exact: true }).click();
      await page.getByRole('menuitemradio', { name: languages[locale].name, exact: true }).click();
      const cookie = (await context.cookies()).find((item) => item.name === 'PARAGLIDE_LOCALE');
      expect(cookie?.value).toBe(locale);
      expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 390 * 24 * 60 * 60);
      expect(cookie!.path).toBe('/');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { name: languages[locale].studio, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: languages[locale].canvas, exact: true })).toBeVisible();

      const storageState = await context.storageState();
      await context.close();
      // New browser context, opposing system language, same persisted site data.
      const reopened = await browser.newContext({ baseURL, storageState, locale: locale === 'en' ? 'zh-CN' : 'en-US' });
      try {
        const next = await reopened.newPage();
        for (const prefix of ['', '/zh', '/ja']) {
          await next.goto(`${prefix}/projects?view=recent#saved`);
          const url = new URL(next.url());
          expect(url.pathname).toBe(`${locale === 'en' ? '' : `/${locale}`}/projects`);
          expect(url.search).toBe('?view=recent');
          expect(url.hash).toBe('#saved');
          await expect(next.locator('html')).toHaveAttribute('lang', locale);
          await expect(next.getByRole('button', { name: languages[locale].switch, exact: true })).toBeVisible();
        }
        expect((await next.request.get('/api/ping')).ok()).toBe(true);
      } finally {
        await reopened.close();
      }
    } finally {
      await context.close();
    }
  });
}

test('first visit follows the browser or an explicit locale link when no preference exists', async ({ browser, baseURL }) => {
  for (const [browserLocale, path, expected] of [
    ['zh-CN', '/', 'zh'],
    ['en-US', '/', 'en'],
    ['ja-JP', '/', 'ja'],
    ['en-US', '/zh', 'zh'],
    ['en-US', '/ja', 'ja'],
  ]) {
    const context = await browser.newContext({ baseURL, locale: browserLocale });
    try {
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
    } finally {
      await context.close();
    }
  }
});
