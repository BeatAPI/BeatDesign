# BeatDesign

**Beat complexity. Design freely.**

The open-source, local-first AI canvas for image and video creation and analysis. BeatDesign brings Projects, a guided Studio, a node-based Canvas, shared assets, generation history, configurable storage, and an official BeatAPI connection into one focused workspace.

There is no login, account system, payment flow, subscription, local credit ledger, admin panel, or API-key issuing service in this repository.

[中文说明](./README.zh-CN.md)

## What is included

- Studio for prompt-first image and video generation, plus Standard and Deep video analysis.
- React Flow Canvas for connected, multi-step creative workflows.
- A project-scoped Assets view shared by Studio and Canvas.
- Local projects, snapshots, generation history, and asset indexing.
- One code-defined catalog of supported BeatAPI image and video models.
- BeatAPI task submission and status polling.
- BeatAPI as the fixed built-in provider; users supply their own BeatAPI API key.
- BeatAPI managed R2 by default, with optional bring-your-own R2/S3 storage.
- Local connection configuration, with optional encryption at rest.
- English and Chinese UI.
- Local SQLite by default and Cloudflare D1 as an optional deployment target.

## Quick start

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.development
pnpm db:push
pnpm dev
```

Open `http://localhost:3020`. Home is the default route. Opening Studio or Canvas does not create a database record until you confirm that you want to start a project. Use the connection button in a workspace header to add your own [BeatAPI API key](https://beatapi.io/dashboard/apikeys) and choose storage, or configure both through `.env.development`.

## How data flows

```text
Studio / Canvas / Assets
  -> local server routes
  -> imported files saved under data/project-assets and indexed in SQLite
  -> generation precheck and a one-time SQLite generation intent
  -> just-in-time provider upload of the durable local reference
  -> BeatAPI image or video task API
  -> provider status polling
  -> generated media copied into the local project asset directory
  -> local generation history and asset index
```

The API key and storage credentials remain server-side. Project state and history live in the local SQLite database. In local SQLite mode, imported image and video files are copied immediately into the project-owned `data/project-assets/<project-id>/` directory and indexed in SQLite before a card is added to the Canvas. Video analysis uploads MP4/MOV input through BeatAPI's file endpoint and stores the resulting text in the same project generation history. Generated images, videos, and video covers are downloaded into the same project-owned directory before the Canvas receives their URLs; provider URLs remain metadata only.

Canvas state is saved as a complete project snapshot after changes, checked again every five seconds while dirty, and flushed when the page is hidden, refreshed, or closed. A populated snapshot cannot be replaced by an unconfirmed empty snapshot.

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
| `pnpm build` | Build the production app |
| `pnpm db:push` | Apply the schema during local development |
| `pnpm db:generate` | Generate a reviewable D1/SQLite migration |
| `pnpm cf:build` | Build the Cloudflare Workers artifact |

## Project structure

```text
src/components/beatcanvas   Canvas UI and interactions
src/components/studio       Guided Studio UI
src/core/adapters           BeatAPI generation adapter
src/core/effects            Model registry and generation lifecycle
src/core/projects           Projects and snapshots
src/core/workspace-lib      Shared asset and workspace utilities
src/routes/api              Local server API
src/config/db               SQLite/D1 schema
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [PROVIDERS.md](./PROVIDERS.md), and [WORKSPACE_MODES.md](./WORKSPACE_MODES.md) for contributor details.

## Security and deployment

The default development server binds to `127.0.0.1`. Connection settings are writable from the trusted local workspace only. If you expose this application to the internet, configure provider and storage credentials through deployment secrets and add your own network access control in front of the app.

Never commit `.env.development`, local databases, or provider credentials.

## License

Licensed under the [Apache License 2.0](./LICENSE). The license covers the code, not BeatAPI trademarks, logos, service access, model-provider rights, or third-party assets. See [TRADEMARKS.md](./TRADEMARKS.md).
