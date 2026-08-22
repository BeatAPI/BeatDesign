# Workspace modes

Each project can be opened in three modes:

- **Studio** is a guided, form-first surface for producing a result quickly.
- **Canvas** is a node-based surface for connected references and multi-step workflows.
- **Assets** is the project-scoped library shared by Studio and Canvas.

All three modes share the same project ID, assets, model catalog, provider connection, generation history, and persistence layer. The last opened mode is stored on the project so the project list can resume in place.

Routes:

- `/studio/:projectId`
- `/canvas/:projectId`
- `/assets/:projectId`
