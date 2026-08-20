# BeatAPI Workspace agent guide

This repository is the open-source workbench. The sibling `../BeatAPI SaaS Template` is a separate product and must not be mixed into this codebase.

## Product boundary

Preserve Home, projects, Studio, Canvas, shared assets, generation history, provider/storage configuration, and the BeatAPI image/video model catalog.

Do not add authentication, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, tickets, CMS, email providers, or unrelated generation adapters.

## Stack

- TanStack Start, React 19, TypeScript
- TanStack Query
- Tailwind CSS 4 and Base UI/shadcn primitives
- Drizzle ORM with SQLite locally and D1 optionally
- Paraglide for English and Chinese

## Rules

- Browser components call typed local API helpers; they do not import the database.
- Provider keys stay server-side.
- Storage entitlement follows billing. BeatAPI managed R2/Files is allowed only with the official `https://api.beatapi.io` billing endpoint; any custom API host must use an operator-owned R2/S3-compatible bucket. File selection stays local and upload is allowed only after generation precheck. Never commit shared storage credentials.
- The model catalog lives in `src/core/effects/effect-registry.ts`.
- BeatAPI request mapping lives in `src/core/adapters/beatapi-adapter.ts`.
- Studio and Canvas share projects, tasks, and assets.
- Add message keys to both `messages/en.json` and `messages/zh.json`.
- Do not edit `src/routeTree.gen.ts` manually.

## Verification

Run `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, and `pnpm build` after changes.
