# WorkBuddy Connector review checklist

This checklist prepares the BeatDesign Connector for local review and a future
WorkBuddy marketplace submission. Completing it does not mean that the
Connector has been submitted, approved, or published.

## Package

- [ ] Cut the Connector from an immutable BeatDesign release commit.
- [ ] Keep `package.json`, `connector-meta.json`, release notes, and the MCP
      tool count aligned.
- [ ] Run `pnpm integration:check:workbuddy`.
- [ ] Run `pnpm integration:pack:workbuddy-runtime` and install the generated
      npm tarball in a clean temporary npm prefix.
- [ ] Run `pnpm integration:package:workbuddy` and inspect the resulting ZIP.
- [ ] Confirm the ZIP contains only `connector-meta.json`, `mcp.json`,
      `icon.svg`, and `skills/beatdesign-workspace/SKILL.md`.
- [ ] Confirm that no API key, token, cookie, local database, or user media is
      present.

## Clean-machine local review

- [ ] Let WorkBuddy prepare the declared managed Node.js runtime.
- [ ] Confirm WorkBuddy installs `@beatapi/beatdesign-workbuddy` without Git,
      pnpm, or a repository checkout on the user's machine.
- [ ] Confirm `http://127.0.0.1:3020/api/ping` returns the healthy response.
- [ ] Connect the package in WorkBuddy and approve the first local MCP trust
      prompt.
- [ ] Confirm all documented `bdesign_*` tools are visible.
- [ ] Create or open a Project, import non-sensitive demo media, and target the
      Project for the MCP session.
- [ ] Make one incremental Canvas change and one incremental Editor change.
- [ ] Confirm both changes become visible in the browser workspace without a
      page refresh.
- [ ] Restore or remove the QA fixture through normal product operations.

## Product and safety boundaries

- [ ] Local import, organization, Canvas work, timeline editing, preview, and
      browser MP4 export work without a BeatAPI key.
- [ ] Remote generation and analysis stop for explicit user confirmation and
      use the user's configured provider credentials.
- [ ] The Connector stays on loopback and does not expose the local workspace
      over the network.
- [ ] The Skill does not claim that a database revision proves a visible result.
- [ ] Missing `ffmpeg` or `ffprobe` returns an actionable setup error for the
      MCP operations that require them.

## Status language

- Package created: the ZIP was generated locally.
- Local review passed: the ZIP connected to a running local BeatDesign runtime.
- Submitted: the ZIP was uploaded and the platform recorded a submission.
- Approved: WorkBuddy explicitly approved that submission.
- Published: BeatDesign is discoverable and installable from the public market.

Record each state separately. Do not infer a later state from an earlier one.
