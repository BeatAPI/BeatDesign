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

## Verify the visible result

After a write, read the returned revision and changed IDs. Canvas and Editor
currently refresh external revisions within about two seconds and on focus.
Use the relevant view tool and leave the user with the exact `workspaceUrl`.
A database revision alone is not proof of a successful visible operation.

Do not export, submit a paid generation, or create extra variants unless the
user's request clearly authorizes that exact action.
