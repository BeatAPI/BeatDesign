import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function check(ja: string, source = '<button>{t("action")}</button>') {
  const root = mkdtempSync(join(tmpdir(), 'beatdesign-i18n-check-'));
  try {
    mkdirSync(join(root, 'messages'));
    mkdirSync(join(root, 'src/components'), { recursive: true });
    for (const [locale, action] of Object.entries({ en: 'Create folder', zh: '创建文件夹', ja })) {
      writeFileSync(join(root, 'messages', `${locale}.json`), JSON.stringify({ action }));
    }
    writeFileSync(join(root, 'src/components/example.tsx'), source);
    return spawnSync(process.execPath, [resolve('scripts/check-i18n.mjs')], { cwd: root, encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('i18n check rejects English copied into a locale even when all keys exist', () => {
  const result = check('Create folder');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Untranslated English in messages\/ja.json: action/);
});

test('i18n check rejects empty non-English translations and hardcoded accessible labels', () => {
  assert.match(check('').stderr, /Empty message in messages\/ja.json: action/);
  const result = check('フォルダーを作成', '<button aria-label="Close">{t("action")}</button>');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /hardcoded UI text: Close/);
});

test('i18n check accepts localized UI and intentional brand names', () => {
  const result = check('フォルダーを作成', '<button>{t("action")}<span>GitHub</span></button>');
  assert.equal(result.status, 0, result.stderr);
});

test('i18n check catches literal UI keys removed from every locale', () => {
  const result = check('フォルダーを作成', `function Loading() {
    const t = useTranslations('Common');
    return <span>{t('loading')}</span>;
  }`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing UI message: Common.loading/);
});
