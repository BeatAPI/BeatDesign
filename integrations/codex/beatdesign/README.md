# BeatDesign Codex plugin

This folder packages the local stdio MCP server plus the BeatDesign workspace
Skill. It does not embed or duplicate the Canvas UI; it hands the exact local
Canvas or Editor URL to Codex's in-app Browser for visible review.

## What actually happens

```text
Browser: pnpm dev  →  http://127.0.0.1:3020  (Canvas/Editor review surface)
Agent:   MCP stdio →  pnpm mcp               (Agent calls 26 tools)
Both processes share the same local SQLite + project files.
```

`bdesign_project_open`, `bdesign_canvas_view`, and `bdesign_editor_view` return
structured browser handoffs. When the Codex Browser skill is available, the
Agent opens or reuses the matching sidebar tab and leaves it visible while MCP
writes are reflected by the local UI.

The MCP session can bind a project with `bdesign_project_target`, so subsequent
project-scoped tools may omit `projectId`.

You do **not** need this plugin for every Agent. Any MCP host that can start a
local stdio command can use BeatDesign. The Codex plugin is only the convenient
install shape for Codex.

## Local Codex install (no marketplace)

1. `pnpm install && pnpm db:push && pnpm dev` in the BeatDesign repo.
2. In Codex, install a **local plugin from folder**:
   `integrations/codex/beatdesign`
3. If Codex copies the plugin elsewhere, set
   `BEATDESIGN_ROOT=/absolute/path/to/Beat Design`
   If Codex's GUI environment does not expose Node.js, also set
   `BEATDESIGN_NODE=/absolute/path/to/node`.
   Tail-frame extraction additionally needs `ffmpeg` on Codex's `PATH`, or
   `BEATDESIGN_FFMPEG=/absolute/path/to/ffmpeg`.
4. Start a new Codex thread and check that `bdesign_project_list` and the
   `beatdesign-workspace` Skill exist.

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
