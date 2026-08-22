import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const enMessages = JSON.parse(read('messages/en.json')) as Record<string, string>;
const zhMessages = JSON.parse(read('messages/zh.json')) as Record<string, string>;

const requiredKeys = [
  'common.upload.drop_to_upload',
  'common.upload.preview',
] as const;

test('shared UI fallback copy has English and Chinese message keys', () => {
  for (const key of requiredKeys) {
    assert.equal(typeof enMessages[key], 'string', `${key} missing in English`);
    assert.notEqual(enMessages[key].trim(), '', `${key} is empty in English`);
    assert.equal(typeof zhMessages[key], 'string', `${key} missing in Chinese`);
    assert.notEqual(zhMessages[key].trim(), '', `${key} is empty in Chinese`);
  }
});

test('image uploader uses localized drag and preview copy', () => {
  const source = read('src/components/image-uploader.tsx');

  assert.doesNotMatch(source, /Drop to upload/);
  assert.doesNotMatch(source, /alt="Preview"/);
  assert.match(source, /common\.upload\.drop_to_upload/);
  assert.match(source, /common\.upload\.preview/);
});

test('workspace shell exposes projects, Studio, Canvas, assets, and provider configuration', () => {
  const source = read('src/components/app/product-page-shell.tsx');
  assert.match(source, /href="\/"/);
  assert.match(source, /\/studio\//);
  assert.match(source, /\/canvas\//);
  assert.match(source, /\/assets\//);
  assert.match(source, /WorkspaceApiConfigDialog/);
});
