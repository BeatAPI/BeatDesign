---
name: beatdesign-workspace
description: Operate a local BeatDesign project through MCP when the user asks to create, organize, generate, inspect, or edit media in BeatDesign, including opening the exact Canvas or Editor in Codex for visible review.
---

# BeatDesign workspace

Use BeatDesign MCP as the semantic control plane and the BeatDesign browser workspace as the review surface. Both operate the same local Project, Assets, Canvas, Timeline, and command history.

## Start with a visible project

1. Call `bdesign_project_list` when the project is not already unambiguous.
2. Call `bdesign_project_target` once. Later project-scoped tools may omit `projectId` in this MCP session.
3. Call `bdesign_project_open` near the start of the task with the view that best matches the work.
4. When `browserHandoff` is returned and the Browser skill is available, open `browserHandoff.url` exactly. Reuse an existing tab for the same project, make it visible, and keep it open as a deliverable. Use `workspaceUrl` for direct links shown to the user.

For Canvas-specific review, call `bdesign_canvas_view` with `cardId` so the workspace selects and focuses the changed card. For timeline review, call `bdesign_editor_view` with the relevant time.

## Change the shared project safely

- Read the current Canvas or Editor state before editing.
- Use incremental Canvas and Editor operations with stable IDs and a stable idempotency key. Never replace a complete Canvas or Timeline document.
- External incremental commands automatically retry a short revision race against the newest authoritative document. If a result still includes `retry`, follow its instruction once after reading the latest state; do not busy-loop.
- Import local media through `bdesign_asset_import` before referencing it from Canvas or Editor.
- Treat generation as asset-first: generated output becomes a Project Asset before placement.

## Import captions

- Prefer `bdesign_editor_import_srt` for an SRT file or complete SRT text. Use `bdesign_editor_edit` with `upsert_caption` only for targeted cue changes; do not represent captions as generic media clips.
- A rejected or malformed SRT import leaves existing captions unchanged. Report the parse error instead of retrying with `replace=true` or clearing the track.
- After import, call `bdesign_editor_view` at the first relevant cue time and confirm the caption text, timing, and line breaks in the visible Editor.

## Continue a video from its tail frame

- Call `bdesign_canvas_continue_from_tail` with one stable command ID. Reuse that ID if delivery is uncertain; do not create a new retry ID, because the operation deliberately reuses one derived frame Asset and one continuation node.
- Call the returned `review.tool` before generation so the user can inspect the extracted frame and continuation node.
- If frame extraction reports that `ffmpeg` is unavailable, stop and explain that the MCP host needs `ffmpeg` on `PATH` or an absolute `BEATDESIGN_FFMPEG`; do not retry the same command until that setup changes.
- Tail-frame extraction and Canvas placement are local deterministic work. The returned `next` generation request is a separate remote action: submit it only when the user has authorized that generation and its provider cost.
- After submission, follow generation status until it succeeds, fails, or needs user action. A successful generation creates an Asset but does not place itself. Read the current continuation card, preserve its generation settings, update the returned `generationCardId` with that output through `bdesign_canvas_apply`, then call `bdesign_canvas_view` with the same card ID.
- If continuation returns `ok=false`, preserve its structured conflict or rollback result. Follow a returned retry instruction at most once after reading current state; do not blindly re-extract frames.

## Export the authoritative timeline

- When the user authorizes an export, call `bdesign_editor_get`, then call `bdesign_editor_render` with the returned revision. The result is a project-owned MP4 Asset that includes visible clips, image overlays, caption burn-in, and mixed audio.
- If rendering reports that `ffmpeg` or `ffprobe` is unavailable, stop and explain that the MCP host needs those binaries on `PATH`, or absolute `BEATDESIGN_FFMPEG` and `BEATDESIGN_FFPROBE` paths.
- A render-affecting edit invalidates the previous current render without deleting its historical Asset. If the timeline changes during rendering, read the latest revision and ask before starting another potentially expensive render.

## Verify what the user can see

After a write, read the returned revision and changed IDs, then inspect the already-open Canvas or Editor. Canvas and Editor currently refresh external revisions within about two seconds and on focus. Confirm the intended card, clip, caption, duration, or media is visible; a successful database revision alone is not completion.

Leave the relevant project tab open at the review point. Do not export, submit a paid generation, or create extra variants unless the user's request clearly authorizes that exact action.
