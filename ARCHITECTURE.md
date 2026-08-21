# Architecture

BeatDesign is a single-user creative application. It has no account boundary and no SaaS commerce layer.

## Product boundary

```text
Projects
  + Home
  + Studio
  + Canvas
  + Assets
  + Generation history
  + Provider configuration
  + Storage configuration
```

Studio and Canvas are two views over the same project, generation, and asset services. Switching modes never creates a second project or backend.

## Runtime flow

The browser calls local `/api` routes. Server routes validate input and call the BeatAPI adapter. The adapter submits image/video tasks and checks `/v1/tasks/:id`. Generation state is stored locally, while provider result URLs are indexed as project assets.

Provider credentials are read from environment variables or the local `config` table. Browser components never receive the raw API key.

Upload storage is a separate adapter boundary. File selection remains browser-local. A successful generation precheck creates a short-lived, one-time SQLite intent that binds the project, model, exact upload count, uploaded URLs, and final generation submission. Required references are promoted only after that point and immediately before task submission; they become project assets only after BeatAPI accepts the task. The built-in provider is fixed to the official `https://api.beatapi.io` endpoint. Official `BEATAPI_MANAGED_R2_*` secrets and self-hosted `R2_*` credentials are deliberately separate and never fall through to each other.

## Persistence

The SQLite/D1 schema contains ten tables:

- `project`
- `project_canvas_state`
- `project_workflow_state`
- `generation_history`
- `generation_upload_intent`
- `generation_intent_upload`
- `asset`
- `generation_asset_link`
- `project_asset_membership`
- `config`

No user, session, role, order, subscription, payment, credit, API-key, ticket, or CMS table belongs in this repository.

## Model catalog

`src/core/effects/effect-registry.ts` is the canonical user-facing catalog. `src/core/adapters/beatapi-adapter.ts` maps that catalog to BeatAPI request bodies. Do not add a second database-backed model registry.

## Deployment boundary

Local SQLite is the default. Cloudflare D1 is supported for hosted deployments. A hosted deployment is still logically single-user; put access control at the network/platform layer if the workspace must be private.
