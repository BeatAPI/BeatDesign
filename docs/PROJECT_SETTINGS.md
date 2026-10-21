# Project settings

Project settings are available from the gear on each Projects card and the
workspace header in Studio, Canvas, Editor and Assets. They edit the same local
project: name (1–240 characters), description (up to 140 characters), and cover.
Project ID, creation date and local storage information are read-only. Project
URLs keep their stable IDs. This does not introduce accounts, sharing or publishing.
Image tiles in the project Asset library also offer **Set as cover**.

## Covers

- A manual cover must be an image Asset belonging to this project. Later imports,
  generations and re-linking assets never replace it.
- Upload cover uses the existing local project Asset import endpoint. Uploads stay
  in the Asset library even when the settings dialog is cancelled.
- Automatic cover selects the earliest uploaded/generated image by Asset creation
  timestamp, then stable Asset ID. Reference-only images are excluded. If there is
  no eligible image, it uses the first local video poster. No usable media or a
  failed poster shows a placeholder; the original video is never loaded by a card.
- Missing/deleted manual cover Assets fall back automatically. Removing the cover
  choice never deletes an Asset. Project cards and the settings preview use 16:9.
- Existing covers are preserved as manual during additive SQLite startup upgrades.
  The schema default also preserves legacy covers when applying `db:push` first;
  new projects explicitly start in automatic mode. Upgrade tests use isolated data.

Video fallback uses the optional server `ffmpeg` decoder from `PATH` or
`BEATDESIGN_FFMPEG`. A membership-checked endpoint caches bounded 512px JPEG
posters under the data directory, with at most two concurrent decodes. Missing
decoders or failed decoding return a placeholder; they do not prevent ordinary
browser playback or require downloading the original video in Projects.

## Shared UI/MCP command

`GET /api/app/projects/:id` returns `{ settings }`, including effective cover,
automatic fallback, and `settingsRevision`.

`PATCH /api/app/projects/:id` accepts:

```json
{
  "expectedRevision": 1,
  "commandId": "unique-command-id",
  "patch": {
    "name": "My film",
    "description": "A short film",
    "cover": { "mode": "manual", "assetId": "project-image-id" }
  }
}
```

Use `cover: { "mode": "auto" }` to reset the choice. The route, generic command
endpoint and `bdesign_project_update` MCP tool use the same `project.update`
Command Kernel path. `bdesign_project_get` returns `settings`. Unknown fields,
external URLs, non-image covers and foreign-project Assets are rejected. Settings
have a separate revision from Canvas/Editor. A stale update returns
`REVISION_CONFLICT` (HTTP 409); the dialog retains edits and asks the user to
reopen before saving. It never automatically overwrites a newer change.

The command uses an atomic revision comparison inside a database transaction and
the existing command receipt/idempotency service. Reuse both command ID and
idempotency key for retries. List/header queries refresh every five seconds while
visible; opening settings always loads the current record.
