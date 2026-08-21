import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { decryptSecret, encryptSecret, isEncryptedSecret } from './crypto';

const restoreEnv = (name: string, value: string | undefined) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

test('encrypts configured provider secrets instead of persisting plaintext', async () => {
  const originalKey = process.env.CONFIG_ENCRYPTION_KEY;
  try {
    process.env.CONFIG_ENCRYPTION_KEY = 'test-only-encryption-key';
    const encrypted = await encryptSecret('beatapi_test_secret');
    assert.equal(isEncryptedSecret(encrypted), true);
    assert.notEqual(encrypted, 'beatapi_test_secret');
    assert.equal(await decryptSecret(encrypted), 'beatapi_test_secret');
  } finally {
    restoreEnv('CONFIG_ENCRYPTION_KEY', originalKey);
  }
});

test('fails closed outside local SQLite when no encryption key is configured', async () => {
  const originalKey = process.env.CONFIG_ENCRYPTION_KEY;
  const originalProvider = process.env.DATABASE_PROVIDER;
  try {
    delete process.env.CONFIG_ENCRYPTION_KEY;
    process.env.DATABASE_PROVIDER = 'd1';
    await assert.rejects(
      encryptSecret('must-not-be-plaintext'),
      /Secret encryption is unavailable/
    );
  } finally {
    restoreEnv('CONFIG_ENCRYPTION_KEY', originalKey);
    restoreEnv('DATABASE_PROVIDER', originalProvider);
  }
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
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_PROVIDER: 'sqlite',
    };
    delete env.CONFIG_ENCRYPTION_KEY;
    const result = spawnSync(
      process.execPath,
      ['--import', tsxImport, '--input-type=module', '--eval', script],
      { cwd: installDir, env, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    const keyPath = join(installDir, 'data', '.workspace-key');
    assert.equal(existsSync(keyPath), true);
    assert.ok(readFileSync(keyPath, 'utf8').trim().length >= 32);
  } finally {
    rmSync(installDir, { recursive: true, force: true });
  }
});
