import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import test from 'node:test';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';
import { startBeatDesignMcpHttpServer } from './http-server';

const requestHeaders = {
  accept: 'application/json, text/event-stream',
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
};

const parseSseResult = async (response: Response) => {
  const dataLine = (await response.text())
    .split('\n')
    .find((line) => line.startsWith('data: '));
  assert.ok(dataLine, 'MCP HTTP response must include an SSE data event');
  return JSON.parse(dataLine.slice('data: '.length)) as Record<string, unknown>;
};

const closeServer = (server: Server) =>
  new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });

test('MCP Streamable HTTP serves the same tool catalog with optional Bearer auth', async () => {
  const server = await startBeatDesignMcpHttpServer({
    host: '127.0.0.1',
    port: 0,
    token: 'test-token',
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('HTTP test server did not expose a TCP address.');
  }

  try {
    const baseUrl = `http://127.0.0.1:${address.port}/mcp`;
    const unauthorized = await fetch(baseUrl, {
      method: 'POST',
      headers: { ...requestHeaders, authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(unauthorized.status, 401);

    const initialized = await fetch(baseUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'beatdesign-http-probe', version: '0.0.1' },
        },
      }),
    });
    assert.equal(initialized.status, 200);
    const initializeResult = await parseSseResult(initialized);
    assert.equal(
      (initializeResult.result as { serverInfo?: { name?: string } }).serverInfo?.name,
      'beatdesign'
    );

    const listed = await fetch(baseUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
    });
    const tools = (await parseSseResult(listed)).result as {
      tools?: Array<{ name: string }>;
    };
    assert.deepEqual(
      tools.tools?.map((tool) => tool.name),
      [...BEATDESIGN_MCP_TOOL_NAMES]
    );
  } finally {
    await closeServer(server);
  }
});

test('MCP HTTP refuses non-loopback binding without authentication', async () => {
  await assert.rejects(
    () =>
      startBeatDesignMcpHttpServer({
        host: '0.0.0.0',
        port: 0,
      }),
    /BEATDESIGN_MCP_TOKEN is required/
  );
});

test('MCP HTTP accepts the configured authenticated non-loopback hostname', async () => {
  const server = await startBeatDesignMcpHttpServer({
    host: '0.0.0.0',
    port: 0,
    token: 'test-token',
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('HTTP test server did not expose a TCP address.');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: 'POST',
      headers: {
        ...requestHeaders,
        host: `0.0.0.0:${address.port}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(response.status, 200);
  } finally {
    await closeServer(server);
  }
});
