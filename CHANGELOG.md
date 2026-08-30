# Changelog

All notable changes to BeatDesign are documented in this file.

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
- Editor autosave adopts the canonical saved document and ignores timestamp-only differences, preventing repeated save echoes from blocking MCP updates.
- Generated and imported media are persisted in project-owned local storage and indexed in SQLite.

### Current boundaries

- Editor snapshots are semantic rather than pixel-rendered.
- MP4 export remains browser-driven and is not yet available as a headless MCP tool.
- Captions, transitions, speed controls, multiple named timelines, and native desktop packaging remain follow-up work.

[0.2.0]: https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.0
