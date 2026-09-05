# BeatDesign for WorkBuddy

This package is the local runtime used by the public BeatDesign WorkBuddy
Connector. WorkBuddy installs it with a managed Node.js runtime and launches it
as one stdio MCP server.

On first use it creates a private local data directory, applies the bundled
SQLite migrations, starts the BeatDesign browser workspace on
`http://127.0.0.1:3020`, and exposes the prebuilt BeatDesign MCP tools to
WorkBuddy.

Projects, imported media, timelines, and provider credentials stay on the
user's machine. Local import, Canvas work, timeline editing, preview, and
browser MP4 export do not require an API key. A confirmed remote generation or
analysis uses the provider credentials configured by the user in BeatDesign.

The package does not expose the local workspace on a public network interface.
Some Node-side media operations require `ffmpeg` or `ffprobe`; when unavailable,
those tools return an actionable setup error while the rest of the workspace
remains usable.
