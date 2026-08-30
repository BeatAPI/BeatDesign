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

Provider credentials are read from environment variables or the local `config` table. Browser components never receive the raw API key.

Upload storage is a separate adapter boundary. File selection remains browser-local. A successful generation precheck creates a short-lived, one-time SQLite intent that binds the project, model, exact upload count, uploaded URLs, and final generation submission. Required references are promoted only after that point and immediately before task submission; they become project assets only after BeatAPI accepts the task. The built-in provider is fixed to the official `https://api.beatapi.io` endpoint. Official `BEATAPI_MANAGED_R2_*` secrets and self-hosted `R2_*` credentials are deliberately separate and never fall through to each other.

## Command boundary

UI actions, the local MCP server, and a future CLI call the same Command Kernel. The kernel owns validation and pure document operations for Canvas and Editor. Persistence boundaries remain responsible for revision checks, durable writes, and returning the authoritative document.

```text
UI / MCP / CLI
       |
Command envelope + validation
       |
Canvas / Editor / Generation commands
       |
revision-checked project persistence
       |
SQLite + project media files
```

MCP does not write SQLite directly or replace an entire Canvas or Timeline document. Its tools call `persistBeatDesignCommand` with a transport-controlled `origin=mcp`. The public UI route assigns `origin=ui` server-side and rejects an `origin` request field. UI-only timeline replacement exists for local autosave and undo/redo, remains revision-checked, and is rejected for MCP/CLI origins. Generation commands are asset-first and intentionally have no `placement` field; the server compiles provider media URLs from project-owned Asset IDs and the one-time generation intent before submission.

Canvas layout persistence is the deliberate exception on the UI side: drag, resize, viewport, and the complete visual arrangement are saved as a revision-checked snapshot. Semantic Canvas operations are also exposed through `canvas.apply`, and external agents must use those operations rather than snapshot replacement.

## Persistence

The SQLite/D1 schema contains twelve tables:

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

## Deployment boundary

Local SQLite is the default. Cloudflare D1 is supported for hosted deployments. A hosted deployment is still logically single-user; put access control at the network/platform layer if the workspace must be private.
