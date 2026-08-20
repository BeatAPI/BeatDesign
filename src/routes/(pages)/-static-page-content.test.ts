import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pages = [
  'terms-of-service.en.mdx',
  'terms-of-service.zh.mdx',
  'privacy-policy.en.mdx',
  'privacy-policy.zh.mdx',
];

for (const page of pages) {
  test(`${page} exports route metadata before its Markdown content`, () => {
    const source = readFileSync(
      new URL(`../../content/pages/${page}`, import.meta.url),
      'utf8'
    );
    assert.match(source, /^export const meta\s*=\s*\{/);
    assert.match(source, /title:\s*['"][^'"]+['"]/);
    assert.match(source, /description:\s*['"][^'"]+['"]/);
    assert.match(source, /updated_at:\s*['"]\d{4}-\d{2}-\d{2}['"]/);
  });
}
