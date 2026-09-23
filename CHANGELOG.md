# Changelog

All notable changes to BeatDesign are documented in this file.

## Unreleased

### Added

- Added a versioned built-in Skill catalog exposed through MCP Resources and two
  read-only compatibility tools, with WorkBuddy runtime packaging and probes.

### Changed

- First-time visitors to unprefixed workspace links now see the browser's
  preferred supported language; an explicit `/zh` or `/ja` link and a saved
  language choice take precedence.
- Simplified Chinese first-run navigation and project setup copy to use
  “创作台、画布、素材库” instead of unexplained English surface names.
- Canvas UI autosave now uses revision-checked incremental commands with explicit
  semantic conflict detection. Editor persistence uses incremental commands for
  supported edits and retains guarded replacement for unsupported operations.
- Shared asset-first preflight, reference preparation, and submission across UI
  and MCP; browser model metadata and requests now use logical model IDs.
- Added lightweight document revision polling, hidden-page suspension, local
  generation status reads, SQLite WAL/busy timeout, and MCP version derivation.
- Added isolated browser/MCP integration coverage to CI and extracted Editor
  persistence and timeline clip components.
- Corrected release status: npm WorkBuddy 0.2.3 exists; GitHub release and market
  approval are separate gates. These Unreleased changes are not in that package.
- Delegated account-level generation concurrency entirely to the active Provider,
  removing BeatDesign's cross-Project mutex and per-Project running-task limit.
- Updated the asset-first generation request to v2: image attachments remain
  generic references, while canonical `@ImageN` prompt directives express first-
  and last-frame intent without separate persisted frame roles.

## [0.2.3] - 2026-09-05

### Added

- A WorkBuddy-managed Node.js runtime package that initializes persistent local
  data, starts the production browser workspace and stdio MCP together, and
  removes the Git, pnpm, database-setup, and manual-start prerequisites for
  Connector users.
- Deterministic WorkBuddy Connector validation and ZIP packaging, plus a
  clean-machine review checklist that keeps package, npm publication, review,
  submission, approval, and marketplace publication states separate.
- Image overlays in the local Editor, with UI and MCP controls for placement, size, opacity, rotation, fades, and replacement with any project-owned image Asset.
- Four caption style presets plus per-cue text, timing, size, width, and vertical-position controls shared by the UI and MCP command path.
- MCP `bdesign_editor_render` support for rendering the authoritative Timeline to a project-owned MP4 with visible clips, overlays, caption burn-in, and mixed audio.
- Japanese localization across the application and public READMEs.

### Changed

- Made new Canvas workflows start with a left-to-right layout and solid, unlabeled connectors while preserving users' saved manual arrangements.
- Made Canvas prompt controls appear on card hover so they do not obstruct everyday workspace use.
- Renamed the Editor side panel to the Agent-neutral Inspector and made it closable and reopenable.
- Simplified BeatAPI key configuration to a clear empty field or full mask with one `Save settings` action.

### Fixed

- Prepared connected local and generated references through the shared upload bridge before remote generation so providers receive public HTTPS media URLs.
- Made static video previews seek past common opening black frames.
- Invalidated stale Timeline renders after render-affecting UI or MCP edits and synchronized the current render state with an existing Canvas Timeline card.

## [0.2.2] - 2026-09-03

### Added

- MCP video frame extraction and Canvas continue-from-tail-frame tools.
- Editor caption track, SRT import, MCP `bdesign_editor_import_srt`, and caption burn-in on browser MP4 export.
- A directly installable Claude Code repository marketplace with a BeatDesign MCP + Skill plugin.
- A WorkBuddy MCP + Skill Connector package with bilingual examples and marketplace metadata.
- `pnpm dev:agent` to start the browser workspace and loopback HTTP MCP together.

### Changed

- Made tail-frame extraction decode the actual final frames instead of assuming a 30fps source.
- Made continue-from-tail-frame retries stable, conflict-aware, and rollback-safe.
- Made SRT replacement validate the complete input before changing saved captions, with durable caption persistence and wrapped multiline preview/export.
- Documented the boundary between the Codex Skill and MCP execution transport.
- Made Agent startup reuse an existing healthy BeatDesign workspace and keep the fixed review URL instead of silently moving to another port.
- Aligned Codex, Claude Code, WorkBuddy, LobeHub, and application package metadata on version `0.2.2`.

## [0.2.1] - 2026-08-30

### Changed

- Fixed the open-source runtime to one local SQLite database and removed environment-file configuration from application startup.
- Made BeatAPI Files the default confirmed-generation upload path while retaining optional, locally encrypted public R2/S3-compatible storage.
- Kept provider selection as a source-level extension point with BeatAPI as the upstream default.

### Removed

- Cloudflare D1, Wrangler, Vercel, hosted deployment scripts, and obsolete SaaS-era assets that were not part of the local workbench.

## [0.2.0] - 2026-08-30

### Added

- A local stdio MCP server with 20 Project, Asset, Canvas, Generation, and Editor tools.
- A shared Command Kernel with runtime schemas, revision checks, stable IDs, idempotent receipts, and project Asset validation.
- Canvas-to-Editor workflows: tail-frame extraction, continuation generation nodes, Timeline nodes, and multi-asset timeline creation.
- Local image, video, and audio import through both the UI and MCP.
- Image clips, audio tracks, non-destructive Takes, split/trim/move/delete, undo/redo, timeline diagnostics, and browser-native MP4 export.
- BeatAPI model capability discovery and asset-first generation contracts.
- Codex plugin packaging plus generic MCP configuration for Claude Code, Cursor, OpenCode, and other stdio hosts.

### Changed

- Canvas and Editor now check for Agent/MCP revisions every two seconds and whenever the page regains focus.
- Canvas rebases pending local layout edits onto newer Agent revisions instead of blocking visible MCP updates; snapshot restoration also removes stale shapes before rebuilding the current document.
- Editor autosave adopts the canonical saved document and ignores timestamp-only differences, preventing repeated save echoes from blocking MCP updates.
- Generated and imported media are persisted in project-owned local storage and indexed in SQLite.
- External Canvas media writes require project-owned Asset IDs, and local image/video/audio imports validate type and size before reading file contents.
- GitHub documentation now includes a product-first English/Chinese README and a BeatDesign release cover.

### Current boundaries

- Editor snapshots are semantic rather than pixel-rendered.
- MP4 export remains browser-driven and is not yet available as a headless MCP tool.
- Caption style presets, transitions, speed controls, multiple named timelines, and native desktop packaging remain follow-up work.

[0.2.3]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.3
[0.2.2]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.2
[0.2.1]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.1
[0.2.0]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.0
