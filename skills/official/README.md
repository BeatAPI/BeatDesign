# Official BeatDesign Skills

This directory is the source of truth for portable creative Skills bundled with
BeatDesign. The registry is intentionally empty until a Skill has completed
prompt evaluation and a visible BeatDesign MCP workflow test.

Each accepted Skill lives in `skills/official/<skill-id>/` and contains exactly
the two required source files:

```text
<skill-id>/
├── skill.json
└── SKILL.md
```

`skill.json` uses schema version `1` from
`src/core/skills/skill-registry.ts`. Its `id` must match the directory name.
`SKILL.md` contains model-readable workflow instructions. A bundled Skill may
reference BeatDesign MCP tools, but it must not contain executable scripts,
credentials, generated user media, or automatic authorization for paid
generation and export.

The Showcase UI and host-specific installation packages are consumers of this
registry. They must not become separate Skill sources of truth.
