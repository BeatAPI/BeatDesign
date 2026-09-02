<p align="center">
  <img src="./docs/assets/beatdesign-readme-cover-v3.jpg" alt="BeatDesign — one local creative workspace, controlled by any MCP-capable agent" width="100%" />
</p>

<h1 align="center">BeatDesign</h1>

<p align="center">
  <strong>One local creative workspace. Any agent.</strong><br />
  Generate on a Canvas, edit on a timeline, and let an MCP-capable Agent operate the same project beside you.
</p>

<p align="center">
  <a href="https://design.beatapi.io">Website</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#agent-control-through-mcp">MCP</a> ·
  <a href="./docs/PRODUCT_PLAN_AND_STATUS.md">Product status</a> ·
  <a href="./README.zh-CN.md">中文</a>
</p>

BeatDesign is a free, open-source, local-first AI media workbench. It combines a guided Studio, an infinite Canvas, a short-form video Editor, and one shared Asset library inside a single local Project.

The browser is your visual workspace. An Agent such as Codex, Claude Code, Cursor, or another MCP-capable host can read and modify the same Project through BeatDesign's 20 local tools. Generic coding Agents use local stdio; QwenWork and Doubao Work can use the local Streamable HTTP endpoint. There is no account system, subscription, local credit ledger, or admin panel in this repository.

## The creative loop

```text
Prompt or local media
        ↓
Studio / Canvas ── generate, branch, connect, reuse
        ↓
Shared Assets ─── image, video, audio, extracted clip, render
        ↓
Editor ────────── trim, split, move, mix, AI redo, export MP4
        ↑
Any MCP Agent ─── inspect and apply project-level commands
```

The result is one continuous workflow instead of separate AI generators, download folders, and editing tools.

## One Project, four views

| View | What it is for |
| --- | --- |
| **Studio** | Prompt-first image/video generation and Standard or Deep video analysis. |
| **Canvas** | Connected media nodes, generation history, references, branching, and reusable outputs. |
| **Editor** | A local short-form timeline for video, still images, and audio, with non-destructive editing and MP4 export. |
| **Assets** | The project-scoped source of truth shared by Studio, Canvas, Editor, and MCP. |

## Why it feels different

- **Local by default.** Projects, Canvas snapshots, timelines, generation history, and imported media stay in the local workspace.
- **Agent-native, not Agent-locked.** BeatDesign exposes standard stdio and Streamable HTTP MCP transports instead of embedding one proprietary chatbot.
- **Asset-first.** Generated and imported media become stable project Assets before they are placed on Canvas or Editor.
- **One command path.** UI and MCP writes pass through the same Command Kernel, revision checks, and persisted receipts.
- **No system FFmpeg setup.** Preview and MP4 export use browser-native WebCodecs and Mediabunny.
- **Provider boundary is explicit.** BeatAPI is the built-in generation adapter; forks can register their own adapter without rewriting Canvas or Editor.

## Quick start

Requirements: Node.js 22+, pnpm 10+, and current Chrome on macOS or Windows.

```bash
pnpm install
pnpm db:push
pnpm dev
```

Open [http://127.0.0.1:3020](http://127.0.0.1:3020).

Local import, Canvas work, timeline editing, preview, and MP4 export do not require an API key. Add your own [BeatAPI API key](https://beatapi.io/dashboard/apikeys) only when you want to generate, analyze media, or use AI redo.

## Agent control through MCP

BeatDesign runs the visual workspace plus one Agent control transport over the same SQLite database:

| Process | Command | Role |
| --- | --- | --- |
| Visual workspace | `pnpm dev` | Opens Studio, Canvas, Editor, and Assets in the browser. |
| Agent control plane | `pnpm --silent mcp` | Exposes project-level tools over stdio. |
| HTTP connector | `pnpm --silent mcp:http` | Exposes `/mcp` on `127.0.0.1:3031` for QwenWork and Doubao Work. |

Run the stdio control plane for coding Agents, or the HTTP connector for office
connectors; normally you do not need to run both.

The repository includes a root `.mcp.json` for compatible hosts and a thin Codex launcher under `integrations/codex/beatdesign`.

The 20 tools are grouped by durable product concepts:

- **Project (3):** list, read, create.
- **Asset (3):** list, read, import a local image/video/audio file.
- **Canvas (3):** read, search, apply incremental operations.
- **Generation (5):** discover models and parameters, submit, refresh status, read history.
- **Editor (6):** read, edit, inspect a semantic snapshot, diagnose, deep-link a view, read command history.

MCP does not automate UI pixels. The Agent reads the Project, applies stable commands, and BeatDesign refreshes the visible Canvas or Editor from the same local state.

See [MCP setup and tool boundaries](./docs/MCP.md).

## What works today

### Canvas and generation

- Image, video, audio, timeline, and text-oriented Canvas nodes.
- Prompt/model/parameter configuration from one code-defined BeatAPI catalog.
- Asset references, connected workflows, generation history, and locally persisted outputs.
- Image/video generation plus Standard and Deep video analysis.
- Canvas-to-Editor handoff through shared Assets and timeline nodes.

### Local Editor

- Video, still-image, and audio clips on a shared timeline.
- Drag-to-trim, split, move, delete, ripple delete, and still-image duration editing.
- Undo/redo, playback, source range selection, audio volume and fades.
- Selected-range AI redo as non-destructive Takes.
- Timeline diagnostics for gaps, overlaps, missing media, duration mismatches, and tiny clips.
- Browser-side H.264/AAC MP4 export; completed renders return to project Assets.

### Local persistence

- SQLite project data under `data/`.
- Project-owned media under `data/project-assets/<project-id>/`.
- Revision-aware Canvas and Editor saving.
- English and Chinese UI.

## Data and provider boundary

```text
Browser UI / MCP
      ↓
Command Kernel + Project services
      ↓
SQLite + data/project-assets
      ↓ only after a confirmed generation request
Generation adapter (BeatAPI by default)
      ↓
Output copied back into the local Asset library
```

API keys and optional R2/S3 credentials are encrypted in the local SQLite workspace. Selecting or dragging a local file does not send it to a provider. BeatDesign persists the file locally first and uploads only the durable project Asset required by a confirmed generation request. BeatAPI Files is the default upload path; users can select their own public R2/S3-compatible bucket in Connections.

BeatDesign does not reproduce provider billing, balance, or rate-limit logic. It returns the provider's result or error to the UI/MCP caller. The upstream repository ships the official BeatAPI adapter; a fork can implement `BaseAdapter`, register it, and select it in `src/config/generation-providers.ts`.

Read [provider architecture](./PROVIDERS.md) and [system architecture](./ARCHITECTURE.md) for the full contract.

## Current v0.2 boundaries

BeatDesign v0.2 is focused on local, short-form AI video workflows:

- Current Chrome on macOS and Windows.
- Common browser-decodable images, MP4/MOV video, and MP3/WAV/M4A/AAC/OGG audio.
- One active timeline per Project and browser-memory-constrained export.
- Canvas and Editor poll for Agent revisions every two seconds; a realtime event bus is not implemented yet.
- Editor MCP snapshot is semantic inspection, not a rendered pixel frame.
- Captions, transitions, speed controls, waveforms, multiple named timelines, and native desktop packaging remain follow-up work.

The complete completed/planned boundary lives in [Product plan and status](./docs/PRODUCT_PLAN_AND_STATUS.md).

## Developer commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local app on `127.0.0.1:3020`. |
| `pnpm --silent mcp` | Start the local MCP server over stdio. |
| `pnpm typecheck` | Check TypeScript contracts. |
| `pnpm test` | Run unit and contract tests. |
| `pnpm i18n:check` | Validate English and Chinese messages. |
| `pnpm build` | Build the production app. |
| `pnpm db:push` | Apply the local SQLite schema during development. |
| `pnpm media:localize` | Copy provider-hosted media in existing snapshots into local project storage. |

## Contributing

Start with [CONTRIBUTING.md](./CONTRIBUTING.md), then use:

- [ARCHITECTURE.md](./ARCHITECTURE.md) for system boundaries.
- [WORKSPACE_MODES.md](./WORKSPACE_MODES.md) for product surfaces.
- [docs/MCP.md](./docs/MCP.md) for Agent integration.
- [DESIGN.md](./DESIGN.md) for the BeatDesign visual language.
- [SECURITY.md](./SECURITY.md) for local-workspace safety.

## License

BeatDesign is licensed under [Apache License 2.0](./LICENSE). The license covers the code, not BeatAPI trademarks, service access, model-provider rights, or third-party assets. The timeline contract is derived from MIT-licensed OpenReel and the browser media pipeline uses MPL-2.0 Mediabunny; see [`third_party/`](./third_party) and [TRADEMARKS.md](./TRADEMARKS.md).
