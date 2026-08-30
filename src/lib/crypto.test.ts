import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { decryptSecret, encryptSecret, isEncryptedSecret } from './crypto';

test('encrypts provider secrets with the local installation key', async () => {
  const encrypted = await encryptSecret('beatapi_test_secret');
  assert.equal(isEncryptedSecret(encrypted), true);
  assert.notEqual(encrypted, 'beatapi_test_secret');
  assert.equal(await decryptSecret(encrypted), 'beatapi_test_secret');
});

test('local SQLite creates a per-install key and encrypts without OS-specific setup', () => {
  const installDir = mkdtempSync(join(tmpdir(), 'beatapi-workspace-crypto-'));
  const moduleUrl = new URL('./crypto.ts', import.meta.url).href;
  const tsxImport = import.meta.resolve('tsx');
  const script = `
    const cryptoModule = await import(${JSON.stringify(moduleUrl)});
    const encrypted = await cryptoModule.encryptSecret('local-secret');
    if (!encrypted.startsWith('enc:v1:')) process.exit(2);
    if (await cryptoModule.decryptSecret(encrypted) !== 'local-secret') process.exit(3);
  `;

  try {
    const result = spawnSync(
      process.execPath,
      ['--import', tsxImport, '--input-type=module', '--eval', script],
      { cwd: installDir, env: process.env, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    const keyPath = join(installDir, 'data', '.workspace-key');
    assert.equal(existsSync(keyPath), true);
    assert.ok(readFileSync(keyPath, 'utf8').trim().length >= 32);
  } finally {
    rmSync(installDir, { recursive: true, force: true });
  }
});
