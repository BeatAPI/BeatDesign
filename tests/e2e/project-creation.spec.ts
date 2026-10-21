import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

for (const mode of ['canvas', 'studio'] as const) {
  test(`choosing ${mode} creates one project and opens it without a second chooser`, async ({
    page,
  }) => {
    const creations: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/app/projects'
      ) {
        creations.push(request.postData() ?? '');
      }
    });
    await page.goto('/projects');
    await page
      .getByRole('button', { name: 'New project', exact: true })
      .first()
      .click();
    const choice = mode === 'canvas' ? 'Start in Canvas' : 'Start in Studio';
    await page.getByRole('button', { name: new RegExp(`^${choice}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/${mode}/[^/?]+$`));
    await expect(
      page.getByRole('heading', { name: 'Start a new project', exact: true })
    ).toHaveCount(0);
    expect(creations).toHaveLength(1);
    expect(JSON.parse(creations[0]).workspaceMode).toBe(mode);
  });
}

test('failed Canvas creation retries in Canvas', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/app/projects', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    expect(route.request().postDataJSON().workspaceMode).toBe('canvas');
    attempts += 1;
    if (attempts === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Creation temporarily unavailable' }),
      });
    }
    return route.continue();
  });
  await page.goto('/projects');
  await page
    .getByRole('button', { name: 'New project', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: /^Start in Canvas/ }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Creation temporarily unavailable'
  );
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page).toHaveURL(/\/canvas\/[^/?]+$/);
  expect(attempts).toBe(2);
});

test('direct Canvas entry requires one explicit create action and retains entry parameters', async ({
  page,
}) => {
  let creations = 0;
  let openedProjectUrl: URL | undefined;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.isNavigationRequest() && /^\/canvas\/[^/]+$/.test(url.pathname)) openedProjectUrl = url;
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/app/projects'
    )
      creations += 1;
  });
  await page.goto(
    '/canvas?target=image&model=nano-banana-pro&prompt=Entry+test'
  );
  const create = page.getByRole('button', {
    name: 'Create in Canvas',
    exact: true,
  });
  await expect(create).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create in Studio', exact: true })
  ).toHaveCount(0);
  expect(creations).toBe(0);
  await create.click();
  await expect(page).toHaveURL(/\/canvas\/[^/?]+/);
  // Entry prompts are deliberately removed after hydration; inspect the actual
  // navigation and the saved draft, rather than racing that cleanup effect.
  expect(openedProjectUrl).toBeDefined();
  const url = openedProjectUrl!;
  expect(url.searchParams.get('target')).toBe('image');
  expect(url.searchParams.get('model')).toBe('nano-banana-pro');
  expect(url.searchParams.get('prompt')).toBe('Entry test');
  const id = url.pathname.split('/').at(-1)!;
  await expect.poll(async () => {
    const snapshot = await (await page.request.get(`/api/app/projects/${id}/snapshot`)).json();
    return snapshot.document.cards.some((card: { prompt?: string }) => card.prompt === 'Entry test');
  }).toBe(true);
  expect(creations).toBe(1);
});
