# BeatAPI Workspace

An open-source, local-first creative workbench for AI image and video generation. It opens on a real Home surface and keeps the product focused: Projects, a guided Studio, a node-based Canvas, shared assets, generation history, configurable storage, and an official BeatAPI connection.

There is no login, account system, payment flow, subscription, local credit ledger, admin panel, or API-key issuing service in this repository.

[中文说明](./README.zh-CN.md)

## What is included

- Studio for prompt-first image and video generation.
- React Flow Canvas for connected, multi-step creative workflows.
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
Studio / Canvas
  -> local server routes
  -> generation precheck and a one-time SQLite generation intent
  -> just-in-time reference upload (only when Generate is confirmed)
  -> BeatAPI image or video task API
  -> provider status polling
  -> local generation history and asset index
```

The API key and storage credentials remain server-side. Project state and history live in the local SQLite database. Generated files remain at the public URLs returned by the provider and are indexed locally instead of being copied again.

Selecting a local file creates a browser-local preview only. It does not upload anything. When the user confirms Generate, the server validates the project, model, prompt, concurrency, and BeatAPI connection, then creates a short-lived, one-time generation intent in SQLite. The intent fixes the project, model, and exact upload count. Uploaded URLs must be referenced by the same generation request, and the intent is consumed when the billable task is submitted. Uploaded inputs enter the project asset index only after BeatAPI accepts the task.

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
