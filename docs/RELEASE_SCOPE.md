# Open-source release scope

This repository contains BeatDesign only. The separate BeatAPI SaaS Template is not part of this codebase.

Included: homepage, projects, Studio, Canvas, provider and upload-storage configuration, supported model and video-analysis registry, generation/analysis lifecycle, uploads, assets, local history, i18n, SQLite persistence, tests, and localhost runtime examples.

Excluded: authentication, login, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, support tickets, CMS, email delivery, and unrelated AI-provider adapters.

Release verification requires a clean install, schema creation, production build (which generates Paraglide and route types), typecheck, test, i18n check, MCP stdio handshake, and local route smoke test. A real paid BeatAPI generation is a separate credentialed end-to-end check.

## v0.2.3 release gate

- [x] Application, Codex, Claude Code, WorkBuddy, Claude marketplace, and LobeHub metadata agree on `0.2.3`.
- [x] The WorkBuddy Connector archive passes deterministic structure validation.
- [x] The packaged WorkBuddy runtime installs in an empty directory, starts the local workspace, completes an MCP handshake, exposes all 27 tools, and keeps data outside the package directory.
- [x] Run `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, and `pnpm build` on the release candidate.
- [ ] Publish `@beatapi/beatdesign-workbuddy@0.2.3` to npm and verify the public registry artifact.
- [ ] Upload the Connector archive to the WorkBuddy Open Platform and submit it for review.
- [ ] Record WorkBuddy approval and public marketplace availability only after each state is independently verified.
- [ ] Push the verified commit, tag `v0.2.3`, and publish the GitHub Release.

## v0.2.2 release gate

- [x] Application, Codex, Claude Code, WorkBuddy, Claude marketplace, and LobeHub metadata agree on `0.2.2`.
- [x] Canvas, Editor, and MCP contracts have automated coverage.
- [x] MCP exposes Project, Asset, Canvas, Generation, and Editor groups without full-document replacement tools.
- [x] Local media import and image clips are documented as shipped capabilities.
- [x] Validate the Codex plugin, Claude Code plugin/marketplace, WorkBuddy package shape, and the 26-tool MCP catalog.
- [x] Verify a clean checkout with `pnpm install --frozen-lockfile`, schema creation, `pnpm build`, typecheck, tests, i18n, and MCP handshake—in that order.
- [x] Run local route smoke tests for the browser workspace and loopback HTTP MCP endpoint.
- [x] Run a visible Canvas/Editor + MCP smoke test: Canvas prompt changes and Editor duration changes appeared without a page refresh, then the QA fixture was restored through MCP.
- [x] Push the verified commit, tag `v0.2.2`, and publish the GitHub Release with explicit user authorization.

Release notes are maintained in [`CHANGELOG.md`](../CHANGELOG.md).
