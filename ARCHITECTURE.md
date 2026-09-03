# Architecture

BeatDesign is a single-user creative application. It has no account boundary and no SaaS commerce layer.

## Product boundary

```text
Projects
  + Home
  + Studio
  + Canvas
  + Editor
  + Assets
  + Generation history
  + Provider configuration
  + Storage configuration
```

Studio, Canvas, Editor, and Assets are views over the same project, generation, asset, and history services. Switching modes never creates a second project or backend.

The shared product model is asset-first:

- A generation creates an `Asset`; it does not own a single UI placement.
- A Canvas node references an Asset, Generation, or Timeline.
- A Timeline clip pins a concrete Asset and never silently follows a Canvas generation's latest output.
- A Take is an alternate Asset for one clip; the original source remains recoverable.
- Canvas edges describe visual organization. Generation lineage describes real derivation and is stored separately.

## Runtime flow

The browser calls local `/api` routes. Server routes validate input and resolve a logical model through the active Generation Provider contract. BeatAPI is the built-in/default provider; forks can register another source-level provider without changing Canvas, Editor, MCP, or the asset-first request contract.

Provider and optional R2/S3 credentials are encrypted in the local `config` table. Browser components never receive raw credentials.

Upload storage is a separate adapter boundary. File selection remains browser-local. A successful generation precheck creates a short-lived, one-time SQLite intent that binds the project, model, exact upload count, uploaded URLs, and final generation submission. Required references are promoted only after that point and immediately before task submission; they become project assets only after the provider accepts the task. The default path uploads supported references to BeatAPI Files. Users may instead configure a public R2/S3-compatible bucket; those credentials remain local and are used only for confirmed generation inputs.

## Command boundary

UI actions and the local MCP server call the same Command Kernel. The kernel owns validation and pure document operations for Canvas and Editor. Persistence boundaries remain responsible for revision checks, durable writes, and returning the authoritative document.

```text
UI / MCP
       |
Command envelope + validation
       |
Canvas / Editor / Generation commands
       |
revision-checked project persistence
       |
SQLite + project media files
```

MCP does not write SQLite directly or replace an entire Canvas or Timeline document. Its tools call `persistBeatDesignCommand` with a transport-controlled `origin=mcp`. The public UI route assigns `origin=ui` server-side and rejects an `origin` request field. UI-only timeline replacement exists for local autosave and undo/redo, remains revision-checked, and is rejected for MCP origins. Generation commands are asset-first and intentionally have no `placement` field; the server compiles provider media URLs from project-owned Asset IDs and the one-time generation intent before submission.

External incremental Canvas and Editor commands use a bounded conflict-recovery wrapper around the same persistence function. If the final CAS write loses a short race to UI autosave, the wrapper reloads the authoritative document and reapplies the same stable-ID operation at most twice. It never retries full-document replacement. Persistent conflicts return the latest revision and an explicit retry instruction.

Compound MCP helpers must preserve those same semantics across their local side effects. Tail-frame continuation derives stable Asset and Canvas IDs from its command ID, shares concurrent calls, uses bounded Canvas conflict recovery, and removes a newly created frame if the Canvas write ultimately fails.

The local MCP session may bind one active Project. View tools return clean workspace URLs plus host-neutral browser handoff metadata. The Codex Skill can open or reuse the exact Canvas or Editor review surface; Claude Code and WorkBuddy packages preserve the same URL for their available browser or user handoff. Every host package remains orchestration over the localhost product, not a second frontend or backend.

Canvas layout persistence is the deliberate exception on the UI side: drag, resize, viewport, and the complete visual arrangement are saved as a revision-checked snapshot. Semantic Canvas operations are also exposed through `canvas.apply`, and external agents must use those operations rather than snapshot replacement.

## Persistence

The local SQLite schema contains twelve tables:

- `project`
- `project_canvas_state`
- `project_timeline_state`
- `project_command_receipt`
- `project_workflow_state`
- `generation_history`
- `generation_upload_intent`
- `generation_intent_upload`
- `asset`
- `generation_asset_link`
- `project_asset_membership`
- `config`

`project_command_receipt` stores bounded, short-lived command results for retry idempotency and powers the current MCP history tool. It is not a permanent audit log; long-term Agent Activity still needs a separate durable event contract.

No user, session, role, order, subscription, payment, credit, API-key, ticket, or CMS table belongs in this repository.

## Model catalog

`src/core/effects/effect-registry.ts` is the canonical user-facing logical catalog. `src/core/generation-providers/` maps those logical IDs to provider bindings and adapters. `src/core/adapters/beatapi-adapter.ts` contains BeatAPI request mapping. Do not leak upstream effect IDs or field names into MCP tools, and do not add a second database-backed model registry.

## Runtime boundary

BeatDesign is a localhost application backed by one SQLite database and project-owned files under `data/`. Cloud database and hosted deployment adapters are intentionally outside this repository.
