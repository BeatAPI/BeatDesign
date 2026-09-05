# BeatDesign WorkBuddy Connector

This directory is the source for the BeatDesign WorkBuddy MCP + Skill
Connector. The public package uses WorkBuddy's managed Node.js runtime to
install and start `@beatapi/beatdesign-workbuddy`. That runtime creates the
local SQLite workspace, starts the browser UI on `http://127.0.0.1:3020`, and
serves the BeatDesign MCP over stdio. Users do not need to clone the repository,
install pnpm, initialize the database, or start a separate process.

The source directory being present does not mean the Connector is listed in the
public WorkBuddy market. Marketplace submission, approval, and publication are
separate states.

## Repository development

From the BeatDesign repository:

```bash
pnpm install
pnpm db:push
pnpm dev:agent
```

The visual workspace is available at `http://127.0.0.1:3020`. Repository-local
testing may reach MCP at `http://127.0.0.1:3031/mcp` by using
[`../mcp.json.snippet`](../mcp.json.snippet). Both processes share the same
local SQLite database and project-owned media files.

Build a local copy of the public managed runtime with:

```bash
pnpm integration:pack:workbuddy-runtime
```

This produces an npm tarball under `dist/` for clean local installation tests.
Publishing that tarball to npm and submitting the Connector to WorkBuddy are
separate external release states.

## Validate and package

From the repository root:

```bash
pnpm integration:check:workbuddy
pnpm integration:package:workbuddy
```

The package command validates the metadata, one-server MCP configuration, icon,
Skill, and version alignment before creating:

```text
dist/beatdesign-workbuddy-connector-v<version>.zip
```

It refuses to overwrite an existing archive. Use
`--output /absolute/path/file.zip` to choose another destination. The generated
ZIP contains only the four submission payloads accepted by WorkBuddy; this
README and local review notes stay outside the uploaded package.

Use [`../REVIEW_CHECKLIST.md`](../REVIEW_CHECKLIST.md) before any submission.
The files in this repository have not themselves passed WorkBuddy review. A
marketplace listing does not embed a second BeatDesign UI: MCP tools return the
exact local Canvas or Editor URL for visible review.

The packaged browser workspace stays on loopback. Project data and encrypted
provider credentials live in the user's operating-system application-data
directory rather than the managed npm installation directory. Do not expose a
development HTTP MCP endpoint on another interface without setting
`BEATDESIGN_MCP_TOKEN` and configuring an authenticated client.
