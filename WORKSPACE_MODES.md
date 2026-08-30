# Workspace modes

Each project can be opened in four views:

- **Studio** is a guided, form-first surface for image/video generation and Standard or Deep video analysis.
- **Canvas** is a node-based surface for connected references, generation, and durable video-analysis reports.
- **Editor** is the local timeline for arranging, trimming, splitting, previewing, and exporting short-form video.
- **Assets** is the project-scoped media library shared by Studio, Canvas, Editor, and MCP.

All four views share the same project ID, Assets, model catalog, provider connection, generation and analysis history, and persistence layer. The last opened view is stored on the project so the project list can resume in place.

Routes:

- `/studio/:projectId`
- `/canvas/:projectId`
- `/editor/:projectId`
- `/assets/:projectId`
