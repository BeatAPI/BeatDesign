# BeatDesign agent guide

BeatDesign is the independent, open-source Create workspace in the broader BeatAPI ecosystem. It is not the BeatAPI website frontend, the sibling `../BeatAPI SaaS Template`, or a copy of the SaaS product. BeatAPI is the built-in/default remote generation provider; the local workspace must remain useful without a BeatAPI account or API key.

## Source of truth

- Read `docs/PRODUCT_PLAN_AND_STATUS.md` before changing product scope or describing a capability as complete.
- Read `ARCHITECTURE.md` before changing framework, database, provider, storage, deployment, MCP, or workspace boundaries.
- Read `PROVIDERS.md` before changing models, provider bindings, uploads, polling, or upstream request mapping.
- Read `DESIGN.md` before making visual or UI decisions. Follow its typography, color, spacing, component, and interaction language unless the user explicitly approves a change.
- Read `RELEASE_SCOPE.md` before describing the repository as release-ready, published, deployed, or verified.
- Roadmaps and marketing material are context, not implementation proof. Current code, tests, and the completed sections of `docs/PRODUCT_PLAN_AND_STATUS.md` define shipped behavior.

## Product boundary

Preserve Home, Projects, Studio, Canvas, Editor, Assets, generation history, provider/storage configuration, and the BeatAPI image/video/analysis model catalog.

Studio, Canvas, Editor, Assets, generation history, and MCP are views or control surfaces over the same local Project, asset, generation, and history services. Do not create separate projects or backends when switching surfaces.

Local import, project organization, Canvas work, timeline editing, preview, and MP4 export must work without an API key. Only a confirmed remote generation, analysis, or AI-redo action may require the user's provider credentials and upload the required inputs.

Do not add authentication, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, tickets, CMS, email providers, cloud-database dependencies, hosted-workspace assumptions, or unrelated generation adapters. BeatData, BeatGTM, BeatLeads, general Agent platforms, social publishing, CRM, and other future BeatAPI product lines are outside this repository.

Do not embed a proprietary general chatbot. BeatDesign must be complete without an Agent while allowing Codex, Claude Code, Cursor, and other MCP-capable Agents to operate the same Project.

## Core product model

- The product is asset-first: a generation creates an `Asset`; it does not own a single UI placement.
- A Canvas node references an Asset, Generation, or Timeline.
- A Timeline clip pins a concrete Asset and must not silently follow a Canvas generation's latest output.
- A Take is an alternate Asset for one clip; the original remains recoverable.
- Canvas edges describe visual organization. Generation lineage records real derivation separately.
- Generated and imported media return to project-owned local storage before they are treated as durable workspace outputs.

## Architecture rules

- Browser components call typed local API helpers; they do not import the database or receive raw provider credentials.
- UI and MCP writes share the same Command Kernel, validation, revision checks, project-asset boundary, and durable persistence path. Any future CLI must use that path too.
- MCP never writes SQLite directly and never replaces an entire Canvas or Timeline document. External Agents use incremental `canvas.apply` and `editor.apply` operations with stable IDs, revisions, and idempotency keys.
- Canvas layout snapshots are a UI persistence exception for drag, resize, and viewport state; external Agents still use semantic Canvas operations.
- Agent changes must become visible in the browser workspace and remain inspectable, reversible where supported, and verifiable. A database revision alone is not proof of a successful user-visible operation.
- Studio, Canvas, Editor, Assets, and MCP share project, task, asset, and generation services rather than duplicating business logic.
- Preview and MP4 export use browser-native WebCodecs and Mediabunny. Do not make system FFmpeg a requirement for the core localhost UI. Node-side MCP frame extraction may use `ffmpeg` from `PATH` or `BEATDESIGN_FFMPEG` and must fail with a clear setup error when unavailable.

## Provider and storage boundary

- BeatAPI is the built-in/default provider for remote image, video, audio, and analysis tasks. BeatDesign does not reproduce BeatAPI account, balance, billing, refund, routing, rate-limit, or API-key-issuing logic; it returns provider results and errors.
- UI and MCP use logical model IDs and capability schemas, not BeatAPI effect IDs or raw upstream fields.
- The canonical user-facing model catalog lives in `src/core/effects/effect-registry.ts`.
- Provider bindings live in `src/core/generation-providers/`; BeatAPI request mapping lives in `src/core/adapters/beatapi-adapter.ts`.
- Forks may add a provider through the source-level provider/adapter extension points without changing Canvas, Editor, Assets, MCP requests, or the asset-first contract. Do not add a second database-backed model registry.
- Provider keys stay server-side. Provider and optional R2/S3-compatible storage credentials stay encrypted in local SQLite.
- File selection stays local. Upload is allowed only after generation precheck and only for inputs required by that confirmed request. BeatAPI Files is the default upload path; users may configure their own public R2/S3-compatible bucket.
- Never commit API keys, provider credentials, shared storage credentials, generated user media, or local SQLite data.

## Stack and repository conventions

- TanStack Start, React 19, and TypeScript.
- TanStack Query for shared browser server-state.
- Tailwind CSS 4 and Base UI/shadcn primitives.
- Drizzle ORM with local SQLite.
- Paraglide for English and Chinese.
- Add user-facing message keys to both `messages/en.json` and `messages/zh.json`.
- Do not edit `src/routeTree.gen.ts` manually.
- Preserve unrelated user changes in a dirty worktree.

## Verification and completion language

After code changes, run:

```text
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm build
```

Run focused browser and MCP checks when changing Canvas, Editor, project persistence, provider submission, or Agent-visible behavior. A release check additionally requires clean installation/schema setup, MCP handshake, and local route smoke testing as defined in `RELEASE_SCOPE.md`.

Keep these states separate when reporting completion: source change, automated checks, browser validation, MCP-to-UI validation, credentialed or paid BeatAPI end-to-end validation, commit, push/merge, GitHub Release, hosted demo, and deployment. Never infer a later state from an earlier one.
