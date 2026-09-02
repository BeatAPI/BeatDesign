# Agent integrations

Every MCP-capable agent needs its own config file. Local stdio hosts launch the
same repository entry in either of these equivalent forms, from any working
directory:

```bash
# Direct (requires Node.js to be available on the host PATH; no cwd dependency):
<repo>/node_modules/.bin/tsx <repo>/scripts/mcp-server.ts

# Via pnpm (needs pnpm on the host's PATH):
pnpm --silent -C "<repo>" mcp
```

`scripts/mcp-server.ts` restarts itself from the repository root when a host
spawns it from another directory, so hosts without a `cwd` option work too.
On Windows use `node_modules/.bin/tsx.cmd`.

Replace `/absolute/path/to/Beat Design` in each template with your clone path.

| Agent | Template | Install location | Notes |
| --- | --- | --- | --- |
| Claude Code | [`claude-code/mcp.json.example`](./claude-code/mcp.json.example) | project `.mcp.json` or `~/.claude.json` | repo root `.mcp.json` is already included; entry also repairs foreign cwd |
| Codex | [`codex/beatdesign/`](./codex/beatdesign/) | Codex plugin folder or `~/.codex/config.toml` `[mcp_servers.beatdesign]` | launcher handles `cd` + `BEATDESIGN_ROOT`; set `BEATDESIGN_NODE` if GUI PATH lacks Node |
| ZCode (智谱) | [`zcode/config.example.json`](./zcode/config.example.json) | `~/.zcode/cli/config.json` or `<repo>/.zcode/config.json` | strict schema; supports `cwd`; also reads `.agents/mcp.json` as fallback |
| OpenCode | [`opencode/opencode.example.json`](./opencode/opencode.example.json) · [`opencode/opencode.v2.example.json`](./opencode/opencode.v2.example.json) | `~/.config/opencode/opencode.json` or project `opencode.json` | 1.x uses flat `mcp`; V2 uses nested `mcp.servers`; both use one command array |
| Cursor | [`cursor/mcp.json.example`](./cursor/mcp.json.example) | `.cursor/mcp.json` or `~/.cursor/mcp.json` | no `cwd` field — rely on the cwd-proof entry |
| Windsurf | [`windsurf/mcp_config.json.example`](./windsurf/mcp_config.json.example) | `.codeium/windsurf/mcp_config.json` | same shape as Cursor |
| VS Code (Copilot) | [`vscode/mcp.json.example`](./vscode/mcp.json.example) | `.vscode/mcp.json` | uses `servers` instead of `mcpServers`; approve on first use |
| Cline / Roo Code | [`cline/mcp_settings.json.example`](./cline/mcp_settings.json.example) | `~/.cline/mcp_settings.json` or `.cline/` (Roo: `.roo/`) | |
| Qwen Code (通义千问) | [`qwen/settings.example.json`](./qwen/settings.example.json) | `~/.qwen/settings.json` or `.qwen/settings.json` | |
| 千问办公 (QwenWork) | [`qwenwork/mcp.json.example`](./qwenwork/mcp.json.example) | Desktop app → 连接器 → paste JSON | HTTP/Streamable HTTP; start `pnpm --silent mcp:http` first |
| Gemini CLI | [`gemini/settings.example.json`](./gemini/settings.example.json) | `~/.gemini/settings.json` or `.gemini/settings.json` | |
| Hermes Agent (Nous Research) | [`hermes/config.yaml.snippet`](./hermes/config.yaml.snippet) | `~/.hermes/config.yaml` | YAML `mcp_servers:` block |
| Kiro | [`kiro/mcp.json.example`](./kiro/mcp.json.example) | `~/.kiro/settings/mcp.json` or `.kiro/settings/mcp.json` | MCP must be enabled in Kiro |
| Trae (字节跳动) | [`trae/mcp.json.example`](./trae/mcp.json.example) | `.trae/mcp.json` | global servers live in the Trae MCP UI panel |
| WorkBuddy | [`workbuddy/mcp.json.snippet`](./workbuddy/mcp.json.snippet) | `~/.workbuddy/mcp.json` | pass an explicit `PATH` env when using `pnpm -C` |
| 豆包办公 / 豆包工作任务 | [`doubao-work/mcp.json.example`](./doubao-work/mcp.json.example) | 技能 · 连接器 · 伙伴 → 新建自定义连接器 | choose HTTP and use the local `/mcp` URL |

Not supported: Doubao desktop (豆包电脑版) currently has no user-facing
local stdio configuration. The separate Doubao Work / work-task product has a
custom HTTP connector; use the dedicated template above.

After registering, restart the agent and look for the `bdesign_*` tools. The
visual workspace stays at `http://127.0.0.1:3020` via `pnpm dev`; MCP writes
poll into the UI within two seconds.
