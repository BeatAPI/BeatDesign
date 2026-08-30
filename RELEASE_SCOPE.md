# Open-source release scope

This repository contains BeatDesign only. The separate BeatAPI SaaS Template is not part of this codebase.

Included: homepage, projects, Studio, Canvas, provider configuration, supported model and video-analysis registry, generation/analysis lifecycle, uploads, assets, local history, i18n, SQLite/D1 persistence, tests, and deployment examples.

Excluded: authentication, login, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, support tickets, CMS, email delivery, and unrelated AI-provider adapters.

Release verification requires a clean install, schema creation, production build (which generates Paraglide and route types), typecheck, test, i18n check, MCP stdio handshake, and local route smoke test. A real paid BeatAPI generation is a separate credentialed end-to-end check.

## v0.2.0 release gate

- [x] Package, MCP server, and Codex plugin versions agree on `0.2.0`.
- [x] Canvas, Editor, and MCP contracts have automated coverage.
- [x] MCP exposes Project, Asset, Canvas, Generation, and Editor groups without full-document replacement tools.
- [x] Local media import and image clips are documented as shipped capabilities.
- [x] Verify a clean checkout with `pnpm install --frozen-lockfile`, schema creation, `pnpm build`, typecheck, tests, i18n, and MCP handshake—in that order.
- [ ] Run a visible Canvas/Editor + MCP smoke test in a browser environment that permits localhost automation.
- [ ] Create the local release commit and tag; pushing and publishing remain explicit external actions.

Release notes are maintained in [`CHANGELOG.md`](./CHANGELOG.md).
