# Open-source release scope

This repository contains BeatDesign only. The separate BeatAPI SaaS Template is not part of this codebase.

Included: homepage, projects, Studio, Canvas, provider and upload-storage configuration, supported model and video-analysis registry, generation/analysis lifecycle, uploads, assets, local history, i18n, SQLite persistence, tests, and localhost runtime examples.

Excluded: authentication, login, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, support tickets, CMS, email delivery, and unrelated AI-provider adapters.

Release verification requires a clean install, schema creation, production build (which generates Paraglide and route types), typecheck, test, i18n check, MCP stdio handshake, and local route smoke test. A real paid BeatAPI generation is a separate credentialed end-to-end check.

## v0.2.4 release and WorkBuddy update

- [x] Merge the current `origin/main` baseline into the local update branch.
- [x] Align application and integration metadata on `0.2.4`.
- [x] Run `pnpm typecheck`, `pnpm test` (417 passing), `pnpm i18n:check`, and `pnpm build`.
- [x] Validate the connector archive and install the runtime package in a clean directory; the package probe completed an MCP handshake, listed 29 tools, and checked the local `/api/ping` route. A production route smoke check confirmed Chinese first visit redirects to `/zh`, an explicit `/zh` link stays Chinese, and a saved English choice remains English.
- [x] Merge the verified code to `main` (`c2db28f0bfd282e17c6f47bfb908f812b5df6a3b`) and confirm CI passes on `main`.
- [x] Publish GitHub Release [`v0.2.4`](https://github.com/BeatAPI/BeatDesign/releases/tag/v0.2.4) with the connector ZIP and npm package assets.
- [x] Publish `@beatapi/beatdesign-workbuddy@0.2.4` to npm and verify the public registry reports `latest = 0.2.4`.
- [x] Publish the previously approved WorkBuddy `v0.2.3` connector in the Open Platform, then upload the `0.2.4` archive to the same connector ID (`oc_321d021032343aea`) and submit the update for review. The platform shows `审核中 v0.2.4` on 2026-09-23 and says review results are expected within seven working days.
- [ ] Record WorkBuddy approval and public marketplace availability separately.

## v0.2.3 release gate

- [x] Application, Codex, Claude Code, WorkBuddy, Claude marketplace, and LobeHub metadata agree on `0.2.3`.
- [x] The WorkBuddy Connector archive passes deterministic structure validation.
- [x] The packaged WorkBuddy runtime installs in an empty directory, starts the local workspace, completes an MCP handshake, exposes all 29 tools plus the bundled Skill catalog Resource, and keeps data outside the package directory.
- [x] Run `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, and `pnpm build` on the release candidate.
- [x] Public registry lists `@beatapi/beatdesign-workbuddy@0.2.3`, published `2026-09-05T10:15:33.475Z` (registry rechecked 2026-09-15). This does not establish that the package contains the current working-tree changes.
- [x] Submit the Connector archive to the WorkBuddy Open Platform; the user's 2026-09-23 approval email identifies the 2026-09-05 submission.
- [x] WorkBuddy approved that submission, per the user's approval email.
- [x] Publish the approved `v0.2.3` connector in the WorkBuddy Open Platform on 2026-09-23. Public marketplace discoverability has not been independently verified.
- A separate `v0.2.3` GitHub Release was not published; `v0.2.4` superseded this release candidate.

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
