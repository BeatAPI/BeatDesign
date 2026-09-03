import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

test('workspace shell exposes projects, Studio, Canvas, assets, and provider configuration', () => {
  const source = read('src/components/app/product-page-shell.tsx');
  assert.match(source, /href="\/"/);
  assert.match(source, /\/studio\//);
  assert.match(source, /\/canvas\//);
  assert.match(source, /\/assets\//);
  assert.match(source, /WorkspaceApiConfigDialog/);
  assert.match(source, /LanguageSwitcher/);
});

test('language switcher exposes English, Chinese, and Japanese locales', () => {
  const localeConfig = read('src/config/locale/index.ts');
  const paraglideConfig = read('src/config/paraglide.ts');

  assert.match(localeConfig, /\['en', 'zh', 'ja'\]/);
  assert.match(localeConfig, /ja: '日本語'/);
  assert.match(paraglideConfig, /\['ja', '\/ja'/);
  assert.match(paraglideConfig, /\['ja', '\/ja\/:path\(\.\*\)\?'/);
});
