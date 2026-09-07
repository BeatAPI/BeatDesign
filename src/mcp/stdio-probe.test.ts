import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';

const send = (
  child: ReturnType<typeof spawn>,
  message: Record<string, unknown>
) => {
  child.stdin?.write(`${JSON.stringify(message)}\n`);
};

const readJsonLine = async (
  child: ReturnType<typeof spawn>,
  timeoutMs = 12_000
) =>
  new Promise<Record<string, unknown>>((resolveLine, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for MCP stdio response'));
    }, timeoutMs);
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      child.stdout?.off('data', onData);
      clearTimeout(timer);
      resolveLine(JSON.parse(buffer.slice(0, newline)) as Record<string, unknown>);
    };
    child.stdout?.on('data', onData);
  });

test('MCP stdio handshake lists the catalogued tools and can list projects', async () => {
  const child = spawn(
    resolve('node_modules/.bin/tsx'),
    ['scripts/mcp-server.ts'],
    {
      cwd: resolve('.'),
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  try {
    send(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'beatdesign-stdio-probe', version: '0.0.1' },
      },
    });
    const initialized = await readJsonLine(child);
    const initResult = initialized.result as {
      serverInfo?: { name?: string; version?: string };
      capabilities?: { resources?: object };
    };
    const packageVersion = (
      JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    const pluginVersion = (
      JSON.parse(
        readFileSync(
          resolve('integrations/codex/beatdesign/.codex-plugin/plugin.json'),
          'utf8'
        )
      ) as { version: string }
    ).version;
    assert.equal(initResult.serverInfo?.name, 'beatdesign');
    assert.equal(initResult.serverInfo?.version, packageVersion);
    assert.equal(pluginVersion, packageVersion);
    assert.ok(initResult.capabilities?.resources);

    send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });
    send(child, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const listed = await readJsonLine(child);
    const tools = (
      listed.result as { tools?: Array<{ name: string }> }
    ).tools?.map((tool) => tool.name);
    assert.deepEqual(tools, [...BEATDESIGN_MCP_TOOL_NAMES]);

    send(child, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
    });
    const listedResources = await readJsonLine(child);
    const resources = (
      listedResources.result as {
        resources?: Array<{ uri: string; mimeType?: string }>;
      }
    ).resources;
    assert.ok(
      resources?.some(
        (resource) =>
          resource.uri === 'beatdesign://skills' &&
          resource.mimeType === 'application/json'
      )
    );

    send(child, {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/templates/list',
    });
    const listedTemplates = await readJsonLine(child);
    const resourceTemplates = (
      listedTemplates.result as {
        resourceTemplates?: Array<{ uriTemplate: string }>;
      }
    ).resourceTemplates;
    assert.ok(
      resourceTemplates?.some(
        (resource) => resource.uriTemplate === 'beatdesign://skills/{skillId}'
      )
    );

    send(child, {
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/read',
      params: { uri: 'beatdesign://skills' },
    });
    const readCatalog = await readJsonLine(child);
    const catalogText = (
      readCatalog.result as { contents?: Array<{ text?: string }> }
    ).contents?.[0]?.text;
    assert.ok(catalogText);
    assert.deepEqual(
      (JSON.parse(catalogText) as { skills?: unknown[] }).skills,
      []
    );

    send(child, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'bdesign_skill_list', arguments: {} },
    });
    const listedSkills = await readJsonLine(child);
    const skillPayload = listedSkills.result as {
      structuredContent?: { result?: { skills?: unknown[] } };
    };
    assert.deepEqual(skillPayload.structuredContent?.result?.skills, []);

    send(child, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'bdesign_project_list', arguments: { limit: 5 } },
    });
    const listedProjects = await readJsonLine(child, 15_000);
    const payload = listedProjects.result as {
      structuredContent?: { result?: unknown };
    };
    assert.ok(Array.isArray(payload.structuredContent?.result));
  } finally {
    child.kill();
  }
});
