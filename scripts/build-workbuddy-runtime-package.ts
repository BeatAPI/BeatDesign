#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

type RootPackage = {
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(repositoryRoot, 'dist', 'workbuddy-runtime-package');
const rootPackage = JSON.parse(
  await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
) as RootPackage;

const runtimePackage = {
  name: '@beatapi/beatdesign-workbuddy',
  version: rootPackage.version,
  description:
    'One-click local BeatDesign Canvas and video Editor runtime for WorkBuddy',
  license: 'Apache-2.0',
  homepage: 'https://design.beatapi.io',
  repository: {
    type: 'git',
    url: 'git+https://github.com/BeatAPI/BeatDesign.git',
  },
  bugs: {
    url: 'https://github.com/BeatAPI/BeatDesign/issues',
  },
  type: 'module',
  bin: {
    'beatdesign-workbuddy': 'bin/beatdesign-workbuddy.mjs',
  },
  engines: {
    node: '>=22',
  },
  files: [
    'app',
    'bin',
    'drizzle',
    'mcp',
    'LICENSE',
    'README.md',
  ],
  dependencies: {
    '@libsql/client': rootPackage.dependencies['@libsql/client'],
    tslib: rootPackage.dependencies.tslib,
  },
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(resolve(outputRoot, 'app'), { recursive: true });
await mkdir(resolve(outputRoot, 'bin'), { recursive: true });
await mkdir(resolve(outputRoot, 'mcp'), { recursive: true });

await build({
  entryPoints: [resolve(repositoryRoot, 'scripts', 'mcp-server.ts')],
  outfile: resolve(outputRoot, 'mcp', 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['@libsql/client'],
  banner: {
    js: "import { createRequire as __beatDesignCreateRequire } from 'node:module'; const require = __beatDesignCreateRequire(import.meta.url);",
  },
  sourcemap: false,
  minify: false,
});

await Promise.all([
  cp(resolve(repositoryRoot, '.output'), resolve(outputRoot, 'app', '.output'), {
    recursive: true,
    filter: (source) => {
      const normalized = source.replaceAll('\\', '/');
      return (
        !normalized.includes('/server/node_modules') &&
        !normalized.includes('/public/demo-assets')
      );
    },
  }),
  cp(
    resolve(repositoryRoot, 'drizzle', 'sqlite'),
    resolve(outputRoot, 'drizzle', 'sqlite'),
    { recursive: true }
  ),
  cp(
    resolve(repositoryRoot, 'integrations', 'workbuddy', 'runtime', 'launcher.mjs'),
    resolve(outputRoot, 'bin', 'beatdesign-workbuddy.mjs')
  ),
  cp(
    resolve(repositoryRoot, 'integrations', 'workbuddy', 'runtime', 'README.md'),
    resolve(outputRoot, 'README.md')
  ),
  cp(resolve(repositoryRoot, 'LICENSE'), resolve(outputRoot, 'LICENSE')),
]);
await writeFile(
  resolve(outputRoot, 'package.json'),
  `${JSON.stringify(runtimePackage, null, 2)}\n`
);

console.log(
  `Prepared @beatapi/beatdesign-workbuddy@${rootPackage.version} in ${outputRoot}`
);
