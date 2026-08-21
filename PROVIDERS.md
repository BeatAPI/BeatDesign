# Provider configuration

BeatAPI is the fixed built-in generation provider implemented by this repository. The upstream URL is intentionally fixed to `https://api.beatapi.io`; users only provide their own BeatAPI API key.

Configure it in either place:

1. Set `BEATAPI_API_KEY` in the server environment.
2. Use the Provider dialog in the workspace header. The key is saved in the local `config` table and takes precedence over the environment fallback.

Set `CONFIG_ENCRYPTION_KEY` to encrypt saved API keys at rest. Keep that key stable: changing it makes previously encrypted values unreadable.

The adapter uses:

- `POST /v1/images/tasks`
- `POST /v1/videos/tasks`
- `GET /v1/tasks/:id`
- `POST /v1/files` for supported reference files

Model support is defined in `src/core/effects/effect-registry.ts`, not discovered dynamically. This keeps Canvas and Studio behavior deterministic. When adding a model, update the registry, request mapping, media capability rules, and tests together.

Kling 2.6 and Kling 3.0 Motion Control are exposed as BeatAPI models. Each run requires exactly one character image and one MP4/MOV motion video uploaded through the connected BeatAPI account. The Workspace never asks users for a KIE key; BeatAPI owns the upstream provider route, billing, polling, and output persistence.

An API with a different request or polling contract still needs its own adapter. This repository does not ship placeholder KIE, Vidu, Evolink, Gemini, Fal, Replicate, or payment-provider integrations.

## Storage

Storage is independently configurable from generation:

- `beatapi` uses the official `https://api.beatapi.io` endpoint with the user's BeatAPI API key. File selection stays local; after generation precheck, supported references go to `POST /v1/files` or the official deployment's managed R2 immediately before task submission.
- Precheck creates a one-time SQLite generation intent that binds project, model, upload count, uploaded URLs, and final task submission. Selecting a file alone never uploads it, and uploaded inputs are not indexed as project assets until BeatAPI accepts the task.
- Self-hosters may select `s3` to send generation references to their own Cloudflare R2 or S3-compatible bucket under the same intent rules.
- The official hosted Workspace may inject `BEATAPI_MANAGED_R2_*` deployment secrets, giving users managed video-input uploads without exposing shared credentials. User-owned storage uses only `R2_*`; the two credential sets are isolated.

Remote generation providers require public HTTPS media URLs. A custom bucket therefore needs `R2_PUBLIC_URL`, normally an R2 custom domain or public bucket domain.
