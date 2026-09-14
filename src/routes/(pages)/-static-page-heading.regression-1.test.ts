import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pages = [
  'terms-of-service.en.mdx',
  'terms-of-service.zh.mdx',
  'terms-of-service.ja.mdx',
  'privacy-policy.en.mdx',
  'privacy-policy.zh.mdx',
  'privacy-policy.ja.mdx',
];

for (const page of pages) {
  test(`${page} leaves the route shell as the single title and update-date owner`, () => {
    const source = readFileSync(
      new URL(`../../content/pages/${page}`, import.meta.url),
      'utf8'
    );
    const markdown = source.replace(
      /^export const meta\s*=\s*\{[\s\S]*?^\}\s*/m,
      ''
    );

    assert.doesNotMatch(markdown, /^#\s+/m);
    assert.doesNotMatch(
      markdown,
      /^\*(?:Last updated|最近更新|最終更新)[^\n]*\*$/m
    );
  });
}
