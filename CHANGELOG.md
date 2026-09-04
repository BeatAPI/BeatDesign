# Changelog

All notable changes to BeatDesign are documented in this file.

## Unreleased

### Added

- Image overlays in the local Editor, with UI and MCP controls for placement, size, opacity, rotation, fades, and replacement with any project-owned image Asset.
- Four caption style presets plus per-cue text, timing, size, width, and vertical-position controls shared by the UI and MCP command path.
- Japanese localization across the released application and public README.

### Changed

- Made new Canvas workflows start with a left-to-right layout and solid, unlabeled connectors while preserving users' saved manual arrangements.
- Made Canvas prompt controls appear on card hover so they do not obstruct everyday workspace use.
- Renamed the Editor side panel to the Agent-neutral Inspector and made it closable and reopenable.
- Simplified BeatAPI key configuration to a clear empty field or full mask with one `Save settings` action.

### Fixed

- Prepared connected local and generated references through the shared upload bridge before remote generation so providers receive public HTTPS media URLs.
- Made static video previews seek past common opening black frames.

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

[0.2.2]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.2
[0.2.1]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.1
[0.2.0]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.0
