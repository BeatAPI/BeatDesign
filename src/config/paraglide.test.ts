import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { compile } from '@inlang/paraglide-js';

import { paraglideCompilerOptions } from './paraglide';

test('the shared Paraglide config can prepare server imports before Vite starts', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'beatapi-paraglide-'));
  const outdir = join(outputRoot, 'paraglide');

  try {
    await compile({ ...paraglideCompilerOptions, outdir });

    await Promise.all([
      access(join(outdir, 'runtime.js')),
      access(join(outdir, 'server.js')),
    ]);
    const runtime = await readFile(join(outdir, 'runtime.js'), 'utf8');
    assert.match(runtime, /\["en","zh","ja"\]/);
    assert.match(runtime, /\/ja/);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
