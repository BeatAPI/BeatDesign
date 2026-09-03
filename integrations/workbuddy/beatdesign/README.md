# BeatDesign WorkBuddy Connector

This is the WorkBuddy Connector submission package for BeatDesign. It uses
the MCP + Skill route and connects to the loopback-only Streamable HTTP server
provided by the local BeatDesign application.

## Local prerequisite

From the BeatDesign repository:

```bash
pnpm install
pnpm db:push
pnpm dev:agent
```

The visual workspace is available at `http://127.0.0.1:3020`, and this
connector reaches MCP at `http://127.0.0.1:3031/mcp`. Both processes share the
same local SQLite database and project-owned media files.

The Connector can be loaded locally for review or submitted to the WorkBuddy
Connector marketplace. The files in this repository have not themselves passed
WorkBuddy review. A marketplace listing does not embed a second BeatDesign UI:
MCP tools return the exact local Canvas or Editor URL for visible review.

The endpoint stays on loopback by default and requires no connector credential.
Do not expose it on another interface without setting
`BEATDESIGN_MCP_TOKEN` and configuring an authenticated client.
