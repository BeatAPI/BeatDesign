# Project organization

This feature uses the existing local Project, Assets and Command Kernel. It adds
organization metadata; it does not migrate production projects or run generation.
The implementation is adapted from JaysonAlbert/BeatDesign draft PR #16,
organization commits `e4ae849` and `2176e20`, with upstream compatibility fixes.
General upstream tracking: [Issue 29](https://github.com/BeatAPI/BeatDesign/issues/29).

## User controls

- Canvas → **Organize Canvas**: preview a group from the selected nodes, name it,
  choose its purpose, expand/collapse, change members, choose a displayed result
  or ungroup. Dragging moves the group and its canonical members together;
  resizing changes the frame. Arrange contents or multiple groups in rows,
  columns or a grid; collapsed groups retain their canonical member positions. Ungrouping keeps cards and source media.
- **Show all versions** opens the grouped take inspector, including failed
  attempts. Preview is read-only: it does not pin a result or change Timeline.
- Assets → **Project organization**: logical folders, explicit project/current-folder
  search and paged results. Narrow screens use an accessible drawer with Escape,
  focus return and retained form input. Removing a folder previews promotion of its assets and
  children to the parent. Files and membership categories do not move.
- **Elements**: create a named character, scene, prop or voice from an existing
  Asset, append versions and choose the current version. Canvas inputs pin an exact
  version; changing current only asks consumers to review. Keep/adopt is explicit.
- **Workflow templates**: preview selected text/generation steps and ordered input
  slots, then save locally. Insertions are independent editable drafts. Bind slots
  to target-project Assets or Element versions; missing required slots block generation.
  Library rename/removal and source-project deletion do not rewrite saved instances.
- **View Timeline usage** reads the actual source helper, including active takes,
  source intervals, hidden/muted tracks and captions. Displayed results remain distinct.

## Storage and command boundary

Canvas v4 adds groups, exact reference bindings, frozen template-instance slots and
view preferences. Readers accept older documents without writing them on read.
Hidden output cards, absolute frames, generation snapshots and raw reference IDs
remain authoritative. Proxies and aggregated edges are display-only.

`project_organization_state` stores per-project logical folders and Elements.
`workflow_template` stores this installation's reusable definitions. Startup upgrades
are additive and repeatable. Existing source media is never copied into templates.

UI and MCP use `persistBeatDesignCommand`. New commands and expanded Canvas
operations require explicit command ID, idempotency key and expected revision.
State changes and receipts share an immediate SQLite transaction. Same-key changed
content rejects; semantic conflicts do not automatically adopt a later revision.
All v4 saves revalidate final project/Element bindings, including undo and old operations.

Canvas generation carries a source card. Preflight and submission verify required
slots, exact references and a digest of reviewed configuration. Intents preserve that
digest; changed inputs require another review. This does not change provider routes.

## Interfaces

UI writes use `/api/app/projects/:id/commands`. Reads include `organization`,
`organization-preview`, `assets` (GET; `organization-assets` is an equivalent alias),
`timeline-usage`, `template-preview` and `/api/app/workflow-templates/` with detail by ID.
Revision queries include the organization revision; an absent organization is revision zero.

MCP adds organization get/apply, asset query, workflow-template list/get/preview/apply
and Timeline usage. Existing asset-list results stay arrays and deduplicate membership.
See `src/core/organization/command-contract.ts` and `canvas-organization.ts`
for command fields. Folder/Element commands use organization revision, Canvas
commands use snapshot revision, template rename/removal use template revision;
new-template capture requires zero and a matching source-Canvas preview.

Limits remain 200 Canvas records, 20 inputs per card and 2 MiB per Canvas document.
Additional limits are 64 groups, 100 instances, 500 folders/eight parent levels,
256 Elements/100 versions each, and 100 templates/128 KiB per definition.

## Verification and isolated preview

`pnpm build && pnpm test:e2e` runs the production UI/MCP checks. The fixture
script `scripts/seed-organization-fixture.ts` requires
an explicitly isolated `BEATDESIGN_DATA_DIR`; it refuses the default production data
directory. It creates 140 synthetic Canvas records, eight groups/twelve overview
entries, over 500 Assets, versioned Elements and an actual Timeline with older takes.

Focused tests cover invariant rejection, receipt-failure rollback, cross-process CAS,
Element binding/removal races, private-template boundaries, replay after receipt expiry,
stale generation intents and active-take ranges. Organization paths assert zero
provider jobs, upload intents and paid calls. Verification results are recorded in `RELEASE_SCOPE.md`; source changes are
not part of an existing published package.

Source checks, isolated preview, human visual acceptance, merge and deployment are
separate states. This branch does not authorize real-film organization or main-instance
replacement.
