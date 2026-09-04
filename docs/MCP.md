# BeatDesign MCP

BeatDesign exposes local stdio and Streamable HTTP MCP servers. They use the same project,
Asset, Command Kernel, provider, and SQLite services as the browser UI; it is
not a second backend.

## Start

```bash
pnpm install
pnpm db:push

# For generic stdio MCP hosts:
pnpm --silent mcp

# For QwenWork / Doubao Work connectors (use this instead of stdio):
pnpm --silent mcp:http

# For the Claude Code plugin or WorkBuddy Connector:
pnpm dev:agent
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

The entry script is working-directory independent: when a host spawns it from
another directory it restarts itself from the repository root first, so the
`@/*` aliases, the SQLite database, and `data/project-assets` always resolve
against this clone. Hosts that cannot set a cwd and prefer pnpm can use
`pnpm --silent -C "/absolute/path/to/Beat Design" mcp` instead. On Windows the
binary is `node_modules/.bin/tsx.cmd`.

Per-agent packages and config templates (Claude Code, ZCode, OpenCode, Cursor, Windsurf, VS
Code, Cline, Roo Code, Qwen Code, QwenWork, Gemini CLI, Hermes, Kiro, Trae,
WorkBuddy, Doubao Work) live in
[`integrations/`](../integrations/README.md).

OpenCode has two configuration generations. The installed 1.x desktop builds use
the flat `mcp.beatdesign` shape in
[`opencode.example.json`](../integrations/opencode/opencode.example.json); OpenCode
V2 uses `mcp.servers.beatdesign` and `disabled: false` from
[`opencode.v2.example.json`](../integrations/opencode/opencode.v2.example.json).
Use the template matching the OpenCode version instead of merging both entries.

QwenWork and Doubao Work use the HTTP endpoint at
`http://127.0.0.1:3031/mcp`. Start `pnpm --silent mcp:http` before creating the
connector. The HTTP server stays on loopback by default; set
`BEATDESIGN_MCP_TOKEN` and send an `Authorization: Bearer ...` header when the
connector configuration supports headers.

The Codex plugin source is under `integrations/codex/beatdesign`. When Codex
copies that plugin outside this repository, pass `BEATDESIGN_ROOT` with the
absolute repository path. Claude Code has a dedicated repository marketplace
and plugin under `integrations/claude-code/beatdesign`; WorkBuddy has an MCP +
Skill Connector under `integrations/workbuddy/beatdesign`. Those two packages
connect to the loopback HTTP endpoint started by `pnpm dev:agent` and therefore
do not depend on the Agent's working directory.

## Mental model

BeatDesign is a visual workspace plus one selected Agent control transport sharing one local database:

1. `pnpm dev` is the visual workbench in the browser.
2. `pnpm mcp` is the Agent control plane over stdio for coding Agents.
3. `pnpm mcp:http` is the optional Streamable HTTP control plane for QwenWork and Doubao Work.
4. `pnpm dev:agent` starts the visual workbench and HTTP control plane together
   for packaged host integrations.

The MCP server returns structured browser handoffs. In Codex, the bundled Skill
uses the in-app Browser to open or reuse the exact Canvas or Editor tab and
leaves it visible while the Agent works. Other hosts can use the clean
`workspaceUrl` returned by the same tools.

Host packages are optional installation layers. Claude Code, OpenCode, Cursor,
and any other MCP stdio host can still start `pnpm --silent mcp` directly.
Claude Code's plugin and the WorkBuddy Connector use the local HTTP command;
QwenWork and Doubao Work use the same endpoint. Marketplace review is not
required for local use.

Repo-root `.mcp.json` is the Claude Code / generic direct-stdio config. See
`integrations/README.md` for the Codex, Claude Code, WorkBuddy, and OpenCode
installation shapes.

## Tool groups

There are **26** tools:

- Project (5): list, get, create, target the current MCP session, and open a
  workspace review surface.
- Asset (4): list, get by project membership, import a local file, and extract a
  video frame.
- Canvas (5): get, browser view/focus, search, incremental apply, and
  continue-from-tail-frame.
- Generation (5): list model capabilities, read one model, submit an
  asset-first request, refresh status, and list history.
- Editor (7): get, incremental edit, SRT import, semantic snapshot, diagnostics,
  deep-link view, and command history.

MCP writes use `origin=mcp` assigned inside the server. `canvas.apply` and
`editor.apply` accept stable IDs, revisions, and idempotency keys. The server
does not expose full Canvas or Timeline replacement.

Call `bdesign_project_target` once after choosing a project. Project-scoped
tools can then omit `projectId` for the lifetime of that MCP session.
`bdesign_project_open`, `bdesign_canvas_view`, and `bdesign_editor_view` return
clean direct links plus `browserHandoff`, `openStrategy`, and `liveProject`
metadata. Canvas links accept a stable card ID and focus that card after the
project is restored.

External incremental Canvas and Editor commands automatically replay up to two
times when their final CAS write loses a short revision race. Every replay
loads the newest authoritative document and reapplies the stable-ID operation;
it never retries a full-document replacement. Recovered results include
`conflictRecovery`; persistent conflicts include a bounded `retry` instruction
with the latest known revision.

`bdesign_canvas_continue_from_tail` uses the same bounded conflict recovery. A
stable command ID also stabilizes its derived frame Asset and continuation node,
so an uncertain or concurrent retry does not duplicate them. If the Canvas write
still fails, a frame created by that attempt is removed before the failure is
returned. The tool creates the local continuation setup only; its returned
`next` generation request remains a separate, potentially paid action.

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

Editor agents add a project-owned image overlay with `add_overlay`, then adjust
its normalized position, width, opacity, rotation, and fades with
`update_overlay`. Overlay clips live on their own visual track, may overlap the
base video, and remain subject to the same revision checks, Asset boundary, and
durable timeline persistence as UI edits. Captions are composited after overlays.

For a newly connected Canvas node, append a `place_card` operation after its
`upsert_card`. By default it places the target once to the right of the frames
listed in `sourceCardIds`, or to the right of the card's `referenceCardIds` when
that field is omitted. This is an explicit initial-layout action, not a live
auto-layout system: later drag positions and large manually arranged graphs stay
saved until a caller explicitly places the card again. References are passed to
generation independently of prompt text; BeatDesign does not insert synthetic
`@Image1` or `@Image2` tokens into a user's prompt.

## Current boundaries

- `bdesign_editor_snapshot` resolves active clips and source times; it does not
  rasterize a pixel frame yet.
- `bdesign_asset_extract_frame` and `bdesign_canvas_continue_from_tail` decode
  the local video file. MCP/Node uses `ffmpeg` on PATH (or `BEATDESIGN_FFMPEG`);
  this is not a required system install for the browser UI.
- SRT import validates the whole subtitle document before replacing the current
  caption track. Malformed input leaves the saved timeline unchanged.
- Browser-only MP4 export is not exposed as a headless MCP tool yet. Caption
  burn-in is included when the browser exports an MP4.
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

## Skill and MCP

- The host Skills are the workflow layer: they tell the Agent when to select a
  project, which MCP tools to combine, where user authorization is required, and
  which Canvas or Editor view must remain open for review.
- MCP is the structured execution layer used by Codex, Claude Code, Cursor, and
  other compatible Agents. Its schemas, project boundary, command receipts, and
  browser handoffs are the supported external control contract.
