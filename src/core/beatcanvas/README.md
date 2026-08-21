# BeatCanvas boundary

BeatCanvas is the node-based canvas surface in BeatDesign. This
directory owns the browser-side generation contract and Canvas domain logic.

## Stable boundaries

- `ProjectSnapshotDocument` in `src/core/projects/project-snapshot.ts` remains
  the canonical persisted canvas document. Provider responses must be adapted
  into that document instead of introducing a second canvas state format.
- Canvas domain types, composer rules, and generation client live in this
  directory. UI lives under `src/components/beatcanvas`.
- `providers/provider-config.ts` defines the public provider identity and the
  server-only endpoint and credential contract.
- BeatAPI is the default provider and uses `https://api.beatapi.io`.
- API keys remain on the server. Client components may display the provider
  name, but must never receive or persist credentials in a project snapshot.

## Main pieces

1. React Flow canvas components under `src/components/beatcanvas/react-flow`.
2. Canvas nodes and controls under `src/components/beatcanvas`.
3. The snapshot schema under `src/core/projects`.
4. The provider contract and BeatAPI adapter.
