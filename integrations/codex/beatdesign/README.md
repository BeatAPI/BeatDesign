# BeatDesign Codex plugin

This folder is only a **Codex packaging wrapper**. It starts the same local
stdio MCP server as `pnpm mcp`. It does not embed the Canvas UI.

## What actually happens

```text
Browser: pnpm dev  →  http://127.0.0.1:3020  (you look at Canvas/Editor)
Agent:   MCP stdio →  pnpm mcp               (Agent calls 20 tools)
Both processes share the same local SQLite + project files.
```

The Agent does **not** open a BeatDesign sidebar inside Codex. You keep the
browser open; the Agent writes through MCP; the UI polls and refreshes.

You do **not** need this plugin for every Agent. Any MCP host that can start a
local stdio command can use BeatDesign. The Codex plugin is only the convenient
install shape for Codex.

## Local Codex install (no marketplace)

1. `pnpm install && pnpm db:push && pnpm dev` in the BeatDesign repo.
2. In Codex, install a **local plugin from folder**:
   `integrations/codex/beatdesign`
3. If Codex copies the plugin elsewhere, set
   `BEATDESIGN_ROOT=/absolute/path/to/Beat Design`
4. Start a new Codex thread and check that `bdesign_project_list` exists.

Marketplace submission is later. Local folder install is enough to test.

## Other Agents

Same MCP command, different config files:

| Host | Needs Codex plugin? | Config |
|---|---|---|
| Codex | Yes, this folder | Local plugin install |
| Claude Code | No | Repo-root `.mcp.json` |
| OpenCode | No | `opencode.json` `mcp.beatdesign` local command |
| Cursor / generic MCP | No | stdio `pnpm --silent mcp` |
| Pi / WorkBuddy / Hermes | Only if that host speaks MCP stdio | Same command |

Generic stdio config:

```json
{
  "mcpServers": {
    "beatdesign": {
      "command": "pnpm",
      "args": ["--silent", "mcp"]
    }
  }
}
```

OpenCode:

```json
{
  "mcp": {
    "beatdesign": {
      "type": "local",
      "command": ["pnpm", "--silent", "mcp"],
      "enabled": true
    }
  }
}
```

Run the host **from the BeatDesign repository** so `pnpm mcp` can find
`package.json`. If the host starts in another directory, point `command` at
this repo's `node_modules/.bin/tsx` and `scripts/mcp-server.ts`, or set
`BEATDESIGN_ROOT`.
