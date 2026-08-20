import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
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
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
