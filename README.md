# BeatDesign

**Beat complexity. Design freely.**

The open-source, local-first AI canvas and video workbench. BeatDesign brings Projects, a guided Studio, a node-based Canvas, a local Edit timeline, shared assets, generation history, configurable storage, and an official BeatAPI connection into one focused workspace.

There is no login, account system, payment flow, subscription, local credit ledger, admin panel, or API-key issuing service in this repository.

[中文说明](./README.zh-CN.md)

## What is included

- Studio for prompt-first image and video generation, plus Standard and Deep video analysis.
- React Flow Canvas for connected, multi-step creative workflows.
- Edit timeline for local video and image clips, non-destructive trim/split/move/delete, still-image duration, undo/redo, audio mixing, and MP4 export.
- Browser-native media processing through WebCodecs and Mediabunny. A system FFmpeg install is not required.
- Audio Asset and Timeline nodes on Canvas, with direct Asset -> Timeline and Timeline -> Canvas navigation.
- A project-scoped Assets view shared by Studio, Canvas, and Edit. Extracted clips and timeline renders are saved back to Assets.
- BeatAPI selected-range redo. Generated results return as non-destructive Takes that can be previewed, activated, or rolled back to the original.
- Local projects, snapshots, generation history, and asset indexing.
- One code-defined catalog of supported BeatAPI image and video models.
- BeatAPI task submission and status polling.
- BeatAPI as the fixed built-in provider; users supply their own BeatAPI API key.
- BeatAPI managed R2 by default, with optional bring-your-own R2/S3 storage.
- Local connection configuration, with optional encryption at rest.
- English and Chinese UI.
- Local SQLite by default and Cloudflare D1 as an optional deployment target.
- A local MCP server for Project, Asset, Canvas, Generation, and Editor tools, plus a thin Codex plugin launcher.

## Quick start

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.development
pnpm db:push
pnpm dev
```

Open `http://localhost:3020`. Home is the default route. Opening Studio or Canvas does not create a database record until you confirm that you want to start a project. Inside a project, switch to **Edit** to import a local video, set the in/out range, split or move clips, add an audio track, adjust volume/fades, and export the complete timeline as MP4. Use **AI redo** only when you want to send the selected range to BeatAPI. Local import, editing, preview, and export work without a BeatAPI key. Use the connection button in a workspace header to add your own [BeatAPI API key](https://beatapi.io/dashboard/apikeys) and choose storage, or configure both through `.env.development`.

## How data flows

```text
Studio / Canvas / Edit / Assets
  -> local server routes
  -> imported files saved under data/project-assets and indexed in SQLite
  -> generation precheck and a one-time SQLite generation intent
  -> just-in-time provider upload of the durable local reference
  -> BeatAPI image or video task API
  -> provider status polling
  -> generated media copied into the local project asset directory
  -> local generation history and asset index
```

The API key and storage credentials remain server-side. Project state and history live in the local SQLite database. In local SQLite mode, imported image, video, and audio files are copied immediately into the project-owned `data/project-assets/<project-id>/` directory and indexed in SQLite. Edit timeline documents are saved separately from Canvas snapshots with revision checks. MP4 exports combine sequential video clips, embedded source audio, and added audio clips into H.264/AAC, then copy the render into project Assets before the browser download starts. Video analysis uploads MP4/MOV input through BeatAPI's file endpoint and stores the resulting text in the same project generation history. Generated images, videos, and video covers are downloaded into the same project-owned directory before the Canvas receives their URLs; provider URLs remain metadata only.

The first release targets current Chrome on macOS and Windows, short-form timelines, common browser-decodable images, MP4/MOV video, and MP3/WAV/M4A/AAC/OGG audio. Export defaults to 1080p at 30 FPS and follows the first visual clip's landscape or portrait orientation. Diagnostics block export when a source is missing, clips overlap, or the visible track contains an unexplained gap. Captions, transitions, speed controls, multiple named timelines per project, and native desktop packaging remain follow-up work.

Canvas state is saved as a complete project snapshot after changes, checked again every five seconds while dirty, and flushed when the page is hidden, refreshed, or closed. Canvas and Edit check for newer Agent/MCP revisions every two seconds and whenever the page becomes visible or focused. A populated snapshot cannot be replaced by an unconfirmed empty snapshot.

Selecting or dragging in a local file does not send it to a provider, but it is persisted immediately on the user's own machine so a refresh, restart, or development hot reload cannot lose it. When the user confirms Generate, the server validates the project, model, prompt, concurrency, and BeatAPI connection, then creates a short-lived, one-time generation intent in SQLite. The durable local reference is uploaded to the configured provider storage only for that confirmed generation. The intent fixes the project, model, and exact upload count, and is consumed when the billable task is submitted.

The `data/` directory is gitignored and contains both the SQLite database and local project assets. Back up or move the directory as one unit when migrating a workspace to another machine.

Storage entitlement follows BeatAPI billing. The built-in provider is fixed to the official `https://api.beatapi.io` endpoint and uses the user's BeatAPI API key. Supported image, audio, and subtitle inputs go through BeatAPI Files; an official hosted deployment can preconfigure managed R2 for video inputs that Files does not accept through the separate `BEATAPI_MANAGED_R2_*` secrets. Self-hosters may instead provide their own Cloudflare R2 or other S3-compatible endpoint, bucket, credentials, and public URL through `R2_*`. The two credential sets never fall through to each other.

No shared R2 secret is committed to this repository. “Preconfigured” means the official deployment supplies its storage credentials as deployment secrets, while a source checkout uses BeatAPI managed Files for supported inputs or the operator's own bucket.

## Supported model catalog

The canonical catalog lives in `src/core/effects/effect-registry.ts`. The current workspace exposes four image models and seven video models through one BeatAPI adapter, including Kling 2.6 and Kling 3.0 Motion Control. Update the registry and adapter together when BeatAPI's public contract changes.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local app on `127.0.0.1:3020` |
| `pnpm typecheck` | Check TypeScript contracts |
| `pnpm test` | Run unit and contract tests |
| `pnpm i18n:check` | Validate English and Chinese messages |
| `pnpm media:localize` | Copy provider-hosted media in existing project snapshots into local project storage |
| `pnpm mcp` | Start the local BeatDesign MCP server over stdio |
| `pnpm build` | Build the production app |
| `pnpm db:push` | Apply the schema during local development |
| `pnpm db:generate` | Generate a reviewable D1/SQLite migration |
| `pnpm cf:build` | Build the Cloudflare Workers artifact |

## Project structure

```text
src/components/beatcanvas   Canvas UI and interactions
src/components/studio       Guided Studio UI
src/components/editor       Local video timeline UI
src/core/adapters           BeatAPI generation adapter
src/core/generation-providers Logical model/provider contracts and bindings
src/core/editor             Timeline contract, persistence, and browser export
src/core/effects            Model registry and generation lifecycle
src/core/projects           Projects and snapshots
src/core/workspace-lib      Shared asset and workspace utilities
src/routes/api              Local server API
src/mcp                     Local MCP server and tool registration
src/config/db               SQLite/D1 schema
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [PROVIDERS.md](./PROVIDERS.md), [MCP setup](./docs/MCP.md), and [WORKSPACE_MODES.md](./WORKSPACE_MODES.md) for contributor details.

For the current product direction, completed scope, and AI-agent handoff context, read [Product plan and status](./docs/PRODUCT_PLAN_AND_STATUS.md) and the [BeatDesign v0.2 PRD](./docs/prd/BEATDESIGN_V0_2.md).

## Security and deployment

The default development server binds to `127.0.0.1`. Connection settings are writable from the trusted local workspace only. If you expose this application to the internet, configure provider and storage credentials through deployment secrets and add your own network access control in front of the app.

Never commit `.env.development`, local databases, or provider credentials.

## License

Licensed under the [Apache License 2.0](./LICENSE). The license covers the BeatDesign code, not BeatAPI trademarks, logos, service access, model-provider rights, or third-party assets. The timeline contract is derived from MIT-licensed OpenReel and the browser media pipeline uses MPL-2.0 Mediabunny; see [`third_party/`](./third_party). See [TRADEMARKS.md](./TRADEMARKS.md).
