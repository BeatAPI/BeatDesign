import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { compile } from '@inlang/paraglide-js';

import { paraglideCompilerOptions } from './paraglide';

test('the shared Paraglide config can prepare server imports before Vite starts', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'beatapi-paraglide-'));
  const outdir = join(outputRoot, 'paraglide');

  try {
    await symlink(resolve('node_modules'), join(outputRoot, 'node_modules'));
    await compile({ ...paraglideCompilerOptions, outdir });

    await Promise.all([
      access(join(outdir, 'runtime.js')),
      access(join(outdir, 'server.js')),
    ]);
    const runtime = await readFile(join(outdir, 'runtime.js'), 'utf8');
    assert.match(runtime, /\["en","zh","ja"\]/);
    assert.match(runtime, /\/ja/);

    const localeRuntime = (await import(pathToFileURL(join(outdir, 'runtime.js')).href)) as {
      extractLocaleFromRequest: (request: Request) => string;
      shouldRedirect: (input: { request: Request }) => Promise<{
        shouldRedirect: boolean;
        redirectUrl?: URL;
      }>;
    };
    const request = (path: string, headers: Record<string, string>) =>
      new Request(`http://127.0.0.1:3020${path}`, { headers });

    assert.equal(
      localeRuntime.extractLocaleFromRequest(
        request('/canvas/project-1', { 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' })
      ),
      'zh'
    );
    assert.equal(
      localeRuntime.extractLocaleFromRequest(
        request('/canvas/project-1', {
          'accept-language': 'zh-CN,zh;q=0.9',
          cookie: 'PARAGLIDE_LOCALE=en',
        })
      ),
      'en'
    );
    assert.equal(
      localeRuntime.extractLocaleFromRequest(
        request('/zh/canvas/project-1', { 'accept-language': 'en-US,en;q=0.9' })
      ),
      'zh'
    );
    assert.equal(
      localeRuntime.extractLocaleFromRequest(
        request('/ja/canvas/project-1', { cookie: 'PARAGLIDE_LOCALE=en' })
      ),
      'ja'
    );
    const redirect = await localeRuntime.shouldRedirect({
      request: request('/canvas/project-1', {
        accept: 'text/html',
        'accept-language': 'zh-CN,zh;q=0.9',
      }),
    });
    assert.equal(redirect.shouldRedirect, true);
    assert.equal(redirect.redirectUrl?.pathname, '/zh/canvas/project-1');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
