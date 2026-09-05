import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';

export const WORKBUDDY_CONNECTOR_DIRECTORY =
  'integrations/workbuddy/beatdesign';

export const WORKBUDDY_CONNECTOR_FILES = [
  'connector-meta.json',
  'mcp.json',
  'icon.svg',
  'skills/beatdesign-workspace/SKILL.md',
] as const;

type PackageJson = {
  name?: string;
  version?: string;
};

type ConnectorMeta = {
  name?: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  source?: string;
  type?: string;
  version?: string;
  minWorkbuddyVersion?: string;
  examples_zh?: string[];
  examples_en?: string[];
};

type McpServer = {
  args?: string[];
  command?: string;
  npmRegistry?: string;
  runtime?: {
    type?: string;
    version?: string;
  };
  type?: string;
  url?: string;
  timeout?: number;
};

type McpConfig = {
  mcpServers?: Record<string, McpServer>;
};

export type WorkBuddyConnectorValidation = {
  connectorDirectory: string;
  files: readonly string[];
  packageVersion: string;
  serverName: string;
  source: string;
};

const readJson = async <T>(path: string) =>
  JSON.parse(await readFile(path, 'utf8')) as T;

export const validateWorkBuddyConnector = async (
  repositoryRoot = process.cwd()
): Promise<WorkBuddyConnectorValidation> => {
  const connectorDirectory = resolve(
    repositoryRoot,
    WORKBUDDY_CONNECTOR_DIRECTORY
  );
  const packageJson = await readJson<PackageJson>(
    resolve(repositoryRoot, 'package.json')
  );
  const connectorMeta = await readJson<ConnectorMeta>(
    resolve(connectorDirectory, 'connector-meta.json')
  );
  const mcpConfig = await readJson<McpConfig>(
    resolve(connectorDirectory, 'mcp.json')
  );

  assert.ok(packageJson.version, 'package.json must define a version');
  assert.equal(
    connectorMeta.version,
    packageJson.version,
    'WorkBuddy Connector version must match package.json'
  );
  assert.equal(connectorMeta.type, 'mcp');
  assert.match(
    connectorMeta.source ?? '',
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'WorkBuddy Connector source must use kebab-case'
  );
  assert.ok(connectorMeta.name, 'WorkBuddy Connector must define name');
  assert.ok(connectorMeta.name_en, 'WorkBuddy Connector must define name_en');
  assert.ok(
    connectorMeta.description,
    'WorkBuddy Connector must define description'
  );
  assert.ok(
    connectorMeta.description_en,
    'WorkBuddy Connector must define description_en'
  );
  assert.ok(
    (connectorMeta.examples_zh?.length ?? 0) >= 2,
    'WorkBuddy Connector must include at least two Chinese examples'
  );
  assert.ok(
    (connectorMeta.examples_en?.length ?? 0) >= 2,
    'WorkBuddy Connector must include at least two English examples'
  );

  const servers = Object.entries(mcpConfig.mcpServers ?? {});
  assert.equal(
    servers.length,
    1,
    'A WorkBuddy Connector package must configure exactly one MCP server'
  );
  const [serverName, server] = servers[0];
  assert.equal(serverName, 'beatdesign');
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'npx');
  assert.deepEqual(server.args, [
    '--yes',
    `@beatapi/beatdesign-workbuddy@${packageJson.version}`,
  ]);
  assert.equal(server.runtime?.type, 'node');
  assert.equal(server.runtime.version, '22');
  assert.equal(server.npmRegistry, 'https://registry.npmjs.org');
  assert.equal(server.timeout, 30_000);

  for (const relativePath of WORKBUDDY_CONNECTOR_FILES) {
    const contents = await readFile(resolve(connectorDirectory, relativePath));
    assert.ok(contents.length > 0, `${relativePath} must not be empty`);
  }

  const icon = await readFile(resolve(connectorDirectory, 'icon.svg'), 'utf8');
  assert.match(icon, /^<svg[\s>]/, 'WorkBuddy icon must be an SVG document');

  const skill = await readFile(
    resolve(connectorDirectory, 'skills/beatdesign-workspace/SKILL.md'),
    'utf8'
  );
  assert.match(skill, /^---\n[\s\S]*?\n---\n/);
  assert.match(skill, /\nname: beatdesign-workspace\n/);
  assert.doesNotMatch(
    skill,
    /\[(?:TODO|PLACEHOLDER)(?::|\])/i,
    'WorkBuddy Skill must not contain unfinished placeholders'
  );

  return {
    connectorDirectory,
    files: WORKBUDDY_CONNECTOR_FILES,
    packageVersion: packageJson.version,
    serverName,
    source: connectorMeta.source ?? '',
  };
};

export const createWorkBuddyConnectorArchive = async (
  repositoryRoot = process.cwd()
) => {
  const validation = await validateWorkBuddyConnector(repositoryRoot);
  const zip = new JSZip();
  const stableTimestamp = new Date('2026-01-01T00:00:00.000Z');

  for (const relativePath of validation.files) {
    const contents = await readFile(
      resolve(validation.connectorDirectory, relativePath)
    );
    zip.file(relativePath, contents, { date: stableTimestamp });
  }

  const archive = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });

  return { archive, validation };
};
