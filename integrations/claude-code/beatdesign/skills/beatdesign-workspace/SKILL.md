---
name: beatdesign-workspace
description: Operate a local BeatDesign project through MCP when the user asks to create, organize, generate, inspect, or edit media in BeatDesign, including captions, tail-frame continuation, and opening the exact Canvas or Editor review URL.
---

# BeatDesign workspace

Use BeatDesign MCP as the semantic control plane and the BeatDesign browser
workspace as the review surface. Both operate the same local Project, Assets,
Canvas, Timeline, and command history.

## Establish the visible project

1. If BeatDesign tools are unavailable, tell the user to run `pnpm dev:agent`
   in their BeatDesign clone, then reconnect the plugin from `/mcp`.
2. Call `bdesign_project_list` when the target project is not unambiguous.
3. Call `bdesign_project_target` once. Later project-scoped tools may omit
   `projectId` for this MCP session.
4. Call `bdesign_project_open` near the start with the view that matches the
   task. Preserve its `workspaceUrl` as the visible review handoff.
5. For Canvas review, call `bdesign_canvas_view` with the changed `cardId`. For
   timeline review, call `bdesign_editor_view` at the relevant time.

Open the returned `workspaceUrl` when the host provides a browser or preview
surface. Otherwise return the exact URL to the user; do not claim the page was
opened when the host cannot open it.

## Change the shared project safely

- Read the current Canvas or Editor state before editing.
- Use incremental Canvas and Editor operations with stable IDs and one stable
  idempotency key. Never replace a complete Canvas or Timeline document.
- If a result still includes `retry`, read the newest state and follow that
  instruction once. Do not busy-loop.
- Import local media through `bdesign_asset_import` before referencing it from
  Canvas or Editor.
- Treat generation as asset-first: output becomes a Project Asset before it is
  placed on Canvas or Editor.

## Update project settings

- Call `bdesign_project_get` and use `settings.settingsRevision` as the expected
  revision for `bdesign_project_update`. Settings revisions are separate from
  Canvas and Editor revisions.
- Update only the requested name, description or cover. A manual cover must be
  an image Asset in this Project; import a local image first when needed. Use
  `cover: { "mode": "auto" }` to restore automatic cover selection.
- Reuse the command ID and idempotency key when delivery is uncertain. On a
  revision conflict, read the latest settings and resolve the conflicting edit
  before submitting again; do not overwrite another change blindly.
- Read the saved settings back and inspect the project card or workspace header.
  Project settings refresh while visible within about five seconds.

## Organize assets and reuse workflows

- Discover the installed tool catalog first; organization tools are available in
  current source and are not included in the published v0.2.5 runtime.
- Use `bdesign_organization_get` / `bdesign_asset_query` for folders and versioned
  Elements. Folder changes are logical; they do not move media files.
- Apply semantic operations with explicit command ID, idempotency key and the
  correct expected revision. Organization, Canvas and template revisions are
  separate. On a semantic conflict, read and review again; do not adopt a newer
  revision automatically. Reuse the original envelope if delivery is uncertain.
- Element references pin exact Asset/version IDs. Changing the current version
  does not silently replace existing references or Timeline clips.
- Use `bdesign_workflow_template_preview` before capture/instantiation, then
  `bdesign_workflow_template_apply`. Keep the reviewed digest and source revision.
  Insertions create editable drafts only; missing required slots block generation.
- Inspect the result in Canvas/Assets. Use `bdesign_timeline_usage` to check actual
  pinned Timeline usage. Organizing, previewing or loading a template must never
  trigger generation or upload.

## Import captions

- Prefer `bdesign_editor_import_srt` for a file or complete SRT text. Use
  `bdesign_editor_edit` with `upsert_caption` only for targeted cue changes.
- A malformed SRT import leaves saved captions unchanged. Report the parse
  error instead of clearing or partially replacing the track.
- After import, call `bdesign_editor_view` at the first relevant cue and ask
  the user to inspect text, timing, wrapping, and line breaks in the Editor.

## Continue from a video's tail frame

- Call `bdesign_canvas_continue_from_tail` with one stable command ID. Reuse
  that ID if delivery is uncertain so retries reuse the derived frame Asset
  and continuation node.
- Call the returned review tool before generation so the extracted frame and
  continuation node can be inspected.
- If frame extraction reports that `ffmpeg` is unavailable, stop and explain
  that the BeatDesign MCP process needs `ffmpeg` on `PATH` or an absolute
  `BEATDESIGN_FFMPEG` value.
- Tail-frame extraction and Canvas placement are local deterministic work. The
  returned generation request is a separate remote action: submit it only when
  the user authorized that generation and its provider cost.
- A successful generation creates an Asset but does not place itself. Update
  the returned generation card with that output through
  `bdesign_canvas_apply`, then focus the same card with
  `bdesign_canvas_view`.

## Export the authoritative timeline

- When the user authorizes an export, call `bdesign_editor_get`, then call
  `bdesign_editor_render` with the returned revision. The result is a
  project-owned MP4 Asset containing visible clips, image overlays, caption
  burn-in, and mixed audio.
- If rendering reports that `ffmpeg` or `ffprobe` is unavailable, stop and
  explain that the MCP process needs those binaries on `PATH`, or absolute
  `BEATDESIGN_FFMPEG` and `BEATDESIGN_FFPROBE` paths.
- Render-affecting edits invalidate the previous current render without
  deleting its historical Asset. If the timeline changes while rendering,
  read the latest revision and ask before starting another render.

## Verify the visible result

After a write, read the returned revision and changed IDs. Canvas and Editor
currently refresh external revisions within about two seconds and on focus.
Use the relevant view tool and leave the user with the exact `workspaceUrl`.
A database revision alone is not proof of a successful visible operation.

Do not export, submit a paid generation, or create extra variants unless the
user's request clearly authorizes that exact action.
