import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const jsonTemplates = [
  'integrations/claude-code/mcp.json.example',
  'integrations/cline/mcp_settings.json.example',
  'integrations/cursor/mcp.json.example',
  'integrations/gemini/settings.example.json',
  'integrations/kiro/mcp.json.example',
  'integrations/qwenwork/mcp.json.example',
  'integrations/doubao-work/mcp.json.example',
  'integrations/opencode/opencode.example.json',
  'integrations/qwen/settings.example.json',
  'integrations/trae/mcp.json.example',
  'integrations/vscode/mcp.json.example',
  'integrations/windsurf/mcp_config.json.example',
  'integrations/workbuddy/mcp.json.snippet',
  'integrations/zcode/config.example.json',
];

type ServerConfig = {
  command?: string | string[];
  args?: string[];
  type?: string;
  url?: string;
};

const asObject = (value: unknown) =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;

const getBeatDesignServer = (config: Record<string, unknown>) => {
  const mcpServers = asObject(config.mcpServers);
  const servers = asObject(config.servers);
  const mcp = asObject(config.mcp);
  const nestedServers = asObject(mcp?.servers);
  return (mcpServers?.beatdesign ??
    servers?.beatdesign ??
    mcp?.beatdesign ??
    nestedServers?.beatdesign) as ServerConfig | undefined;
};

test('all JSON Agent integration templates are valid and target the MCP entrypoint', () => {
  for (const relativePath of jsonTemplates) {
    const absolutePath = resolve(relativePath);
    const config = JSON.parse(readFileSync(absolutePath, 'utf8')) as Record<
      string,
      unknown
    >;
    const server = getBeatDesignServer(config);

    assert.ok(server, `${relativePath} must define beatdesign`);
    if (server.url) {
      assert.equal(server.type, 'streamable-http', `${relativePath} must use Streamable HTTP`);
      assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
      continue;
    }

    assert.ok(server.command, `${relativePath} must define a command`);

    const command =
      typeof server.command === 'string'
        ? [server.command, ...(server.args ?? [])]
        : server.command ?? [];
    assert.ok(
      command.some((part) => String(part).endsWith('scripts/mcp-server.ts')),
      `${relativePath} must invoke scripts/mcp-server.ts`
    );
  }
});
