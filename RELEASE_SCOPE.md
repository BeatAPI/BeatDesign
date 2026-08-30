# Open-source release scope

This repository contains BeatDesign only. The separate BeatAPI SaaS Template is not part of this codebase.

Included: homepage, projects, Studio, Canvas, provider and upload-storage configuration, supported model and video-analysis registry, generation/analysis lifecycle, uploads, assets, local history, i18n, SQLite persistence, tests, and localhost runtime examples.

Excluded: authentication, login, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, support tickets, CMS, email delivery, and unrelated AI-provider adapters.

Release verification requires a clean install, schema creation, production build (which generates Paraglide and route types), typecheck, test, i18n check, MCP stdio handshake, and local route smoke test. A real paid BeatAPI generation is a separate credentialed end-to-end check.

## v0.2.1 release gate

- [x] Package, MCP server, and Codex plugin versions agree on `0.2.1`.
- [x] Canvas, Editor, and MCP contracts have automated coverage.
- [x] MCP exposes Project, Asset, Canvas, Generation, and Editor groups without full-document replacement tools.
- [x] Local media import and image clips are documented as shipped capabilities.
- [x] Verify a clean checkout with `pnpm install --frozen-lockfile`, schema creation, `pnpm build`, typecheck, tests, i18n, and MCP handshake—in that order.
- [x] Run a visible Canvas/Editor + MCP smoke test: Canvas prompt changes and Editor duration changes appeared without a page refresh, then the QA fixture was restored through MCP.
- [x] Prepare the local release branch and release documentation; GitHub push, merge, tag, and Release remain explicit external actions performed only with user authorization.

Release notes are maintained in [`CHANGELOG.md`](./CHANGELOG.md).
