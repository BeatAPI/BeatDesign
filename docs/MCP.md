# BeatDesign MCP

BeatDesign exposes one local stdio MCP server. It uses the same project,
Asset, Command Kernel, provider, and SQLite services as the browser UI; it is
not a second backend.

## Start

```bash
pnpm install
pnpm db:push
pnpm --silent mcp
```

For a generic MCP host, register:

```json
{
  "mcpServers": {
    "beatdesign": {
      "command": "/absolute/path/to/Beat Design/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/Beat Design/scripts/mcp-server.ts"]
    }
  }
}
```

The Codex plugin source is under `integrations/codex/beatdesign`. When a host
copies that plugin outside this repository, pass `BEATDESIGN_ROOT` with the
absolute repository path.

## Mental model

BeatDesign is two processes sharing one local database:

1. `pnpm dev` is the visual workbench in the browser.
2. `pnpm mcp` is the Agent control plane over stdio.

An Agent never "opens the Canvas as a sidebar" inside Codex or Claude Code.
It calls tools. You watch the same project at `http://127.0.0.1:3020`.

The Codex plugin is optional packaging. Claude Code, OpenCode, Cursor, and any
other MCP stdio host can skip it and start `pnpm --silent mcp` directly. A
marketplace application is not required for local use.

Repo-root `.mcp.json` is the Claude Code / generic host config. See
`integrations/codex/beatdesign/README.md` for Codex folder install and
OpenCode `mcp` config.

## Tool groups

There are **20** tools:

- Project (3): list, get, create.
- Asset (3): list, get by project membership, and import a local file.
- Canvas (3): get, search, incremental apply.
- Generation (5): list model capabilities, read one model, submit an
  asset-first request, refresh status, and list history.
- Editor (6): get, incremental edit, semantic snapshot, diagnostics, deep-link
  view, and command history.

MCP writes use `origin=mcp` assigned inside the server. `canvas.apply` and
`editor.apply` accept stable IDs, revisions, and idempotency keys. The server
does not expose full Canvas or Timeline replacement.

Generation tools accept a logical `modelId`, generic `parameters`, and Asset
references. Call `bdesign_generation_models` or
`bdesign_generation_model_get` before choosing parameters. Outputs are Assets;
placing them on Canvas or Editor remains a separate command.
`bdesign_generation_submit` submits once through the configured generation
provider. BeatDesign does not duplicate API-key validity, balance, billing, or
rate-limit policy. BeatAPI (or a fork's selected provider) remains authoritative,
and its response or error details are returned to the MCP caller.

`bdesign_canvas_apply` and `bdesign_editor_edit` advertise every supported
incremental operation as a concrete JSON Schema. Agents can discover required
IDs, time fields, media roles, card parameters, Takes, and render fields from
the MCP tool contract instead of guessing an opaque operation object.

## Current boundaries

- `bdesign_editor_snapshot` resolves active clips and source times; it does not
  rasterize a pixel frame yet.
- Browser-only MP4 export is not exposed as a headless MCP tool yet.
- `bdesign_asset_import` copies a local image, video, or audio file into the
  project Asset library from an absolute path. It does not place the Asset on
  Canvas or Editor; use `bdesign_canvas_apply` or `bdesign_editor_edit` after.
- `bdesign_asset_import` is the local-file bridge. Generation still accepts
  project Asset IDs rather than arbitrary file paths; the shared generation
  path performs any provider upload that is required after submission.
- Command history is a bounded retry receipt log, not a permanent audit trail.
- Live UI event push is not implemented. Canvas and Editor poll project
  revisions every two seconds while idle and check again on focus/visibility,
  so MCP writes become visible without a full event bus.
