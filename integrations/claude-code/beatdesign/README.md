# BeatDesign for Claude Code

This plugin adds the BeatDesign workspace Skill and connects Claude Code to the
local BeatDesign MCP server. It does not embed another editor or create a second
project store: Claude Code and the browser workspace operate the same local
Project, Assets, Canvas, Timeline, and command history.

## Start BeatDesign

From the BeatDesign repository:

```bash
pnpm install
pnpm db:push
pnpm dev:agent
```

The browser workspace runs at `http://127.0.0.1:3020`; the plugin connects to
the loopback-only MCP endpoint at `http://127.0.0.1:3031/mcp`.

## Test the plugin from this clone

```bash
claude --plugin-dir integrations/claude-code/beatdesign
```

Inside Claude Code, check `/mcp` for the `beatdesign` server and ask:

> Open my latest BeatDesign project, import these subtitles, and leave the
> Editor at the first caption for review.

## Install from the repository marketplace

After this repository is available on GitHub:

```text
/plugin marketplace add BeatAPI/BeatDesign
/plugin install beatdesign@beatdesign
```

Run `/reload-plugins` if Claude Code asks you to activate the newly installed
plugin. Keep `pnpm dev:agent` running while using it.

The loopback MCP endpoint is intentionally unauthenticated because it accepts
connections only from this machine. Do not bind it to a non-loopback address
without setting `BEATDESIGN_MCP_TOKEN`.
