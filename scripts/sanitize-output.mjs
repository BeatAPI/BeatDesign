import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['.output', '.wrangler'];
const textExtensions = new Set([
  '',
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.txt',
  '.xml',
]);

const replacements = [
  ['NEXT' + '_PUBLIC_', 'VITE_'],
  ['ship' + 'any-tanstack-dev', 'beatapi-tanstack-dev'],
  ['Ship' + 'Any', 'BeatAPI'],
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!textExtensions.has(path.extname(entry.name))) continue;
    files.push(filePath);
  }
  return files;
}

let changed = 0;
/** URL path -> fresh fs stats for every rewritten public asset. */
const touchedPublicFiles = new Map();

for (const root of roots) {
  if (!(await exists(root))) continue;
  for (const filePath of await walk(root)) {
    const source = await readFile(filePath, 'utf8');
    let next = source;
    for (const [from, to] of replacements) {
      next = next.replaceAll(from, to);
    }
    if (next !== source) {
      await writeFile(filePath, next);
      changed += 1;
      if (root === '.output' && filePath.startsWith('.output/public/')) {
        touchedPublicFiles.set(
          path.relative('.output/public', filePath),
          await stat(filePath)
        );
      }
    }
  }
}

/*
 * Nitro embeds a per-asset manifest (size/mtime/etag) inside the server
 * bundle. Rewriting files above changes their bytes, so the manifest must be
 * re-synced or the server sends a stale Content-Length and browsers abort
 * with ERR_CONTENT_LENGTH_MISMATCH (client hydration dies).
 */
async function syncServerManifests() {
  if (touchedPublicFiles.size === 0) return;
  const serverDir = '.output/server';
  if (!(await exists(serverDir))) return;

  for (const filePath of await walk(serverDir)) {
    const bundle = await readFile(filePath, 'utf8');
    let next = bundle;

    for (const [relPath, info] of touchedPublicFiles) {
      const escaped = relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const manifestEntry = new RegExp(
        `\\{[^{}]*"path": "\\.\\./public/${escaped}"[^{}]*\\}`,
        'g'
      );
      next = next.replace(manifestEntry, (entry) =>
        entry
          .replace(/"size": \d+/, `"size": ${info.size}`)
          .replace(
            /"mtime": "[^"]*"/,
            `"mtime": "${info.mtime.toISOString()}"`
          )
          // etag is "\"<hex-size>-<hash>\"" — keep the escaped quotes, patch
          // only the size prefix so conditional requests stay coherent.
          .replace(
            /("etag": "(?:\\")?)[0-9a-f]+(-)/g,
            `$1${info.size.toString(16)}$2`
          )
      );
    }

    if (next !== bundle) {
      await writeFile(filePath, next);
    }
  }
}

await syncServerManifests();

if (changed > 0) {
  console.log(`sanitize-output: cleaned ${changed} generated files`);
}
