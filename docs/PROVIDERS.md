# Provider configuration

BeatAPI is the built-in and default generation/analysis provider. The official BeatAPI adapter keeps its upstream URL fixed to `https://api.beatapi.io`; users only provide their own BeatAPI API key.

BeatAPI owns account-level generation concurrency. BeatDesign does not impose a separate cross-Project or per-Project generation limit; it submits each confirmed request and surfaces the provider's admission error when the connected account has no remaining capacity.

Configure it in the Provider dialog in the workspace header. The key is encrypted in the local `config` table with a per-install key stored under `data/`.

The adapter uses:

- `POST /v1/images/tasks`
- `POST /v1/videos/tasks`
- `POST /v1/video-analysis/tasks`
- `GET /v1/tasks/:id`
- `POST /v1/files` for supported reference files

User-facing model capabilities are defined in `src/core/effects/effect-registry.ts`. Provider bindings live in `src/core/generation-providers/`; MCP and UI use the logical model id and capability schema, not BeatAPI `effectId` or raw upstream fields.

UI precheck and submission accept the asset-first generation contract. Studio,
Canvas, Editor redo, and MCP share the server-side preflight and submission
service. Preflight validates project ownership, readable references, model
parameters, and provider configuration without uploading files. Only the
subsequent confirmed submission prepares remote delivery URLs. Browser status
requests read local task state; provider synchronization runs server-side.

The built-in catalog includes the current BeatAPI GPT Image 2.5 Flare/Sunburst, Wan 3.0/Prime, HappyHorse 1.0/1.1, and MiniMax H3 Max/Max Turbo contracts. Their resolution casing, duration ranges, reference limits, required-image rules, seed support, and upstream request field names are preserved by the adapter.

Image attachments remain generic references in the shared BeatDesign request contract. Most first-frame and last-frame intent uses explicit prompt directives such as `Use @Image1 as the first frame.` and `Use @Image2 as the last frame.` The MiniMax H3 Max pair is an upstream exception: its dedicated two-slot media schema maps attachment order directly to first frame then last frame, matching BeatAPI's published contract.

Kling 2.6 and Kling 3.0 Motion Control are exposed as BeatAPI models. Each run requires exactly one character image and one MP4/MOV motion video uploaded through the connected BeatAPI account. The Workspace never asks users for a KIE key; BeatAPI owns the upstream provider route, billing, polling, and output persistence.

Video Analysis is exposed as a stable BeatAPI workflow with Standard and Deep depth controls. The Workspace uploads one MP4/MOV input, submits the analysis task, polls `GET /v1/tasks/:id`, and stores the returned report text and usage in the local project history. Provider-specific Gemini routing remains private to BeatAPI.

An API with a different request or polling contract needs its own adapter. Forks can register one in `src/config/generation-providers.ts`, bind only the logical models they support, and change `ACTIVE_GENERATION_PROVIDER_ID` in the same file. BeatAPI remains the upstream default; an unknown configured id fails explicitly so it cannot accidentally submit a task to another provider. This repository does not ship placeholder KIE, Vidu, Evolink, Gemini, Fal, Replicate, or payment-provider integrations.

A custom provider definition owns adapter construction, readiness checks, parameter validation, model bindings, upstream model names, and upload paths. Provider credentials must stay server-side. Switching providers does not change Canvas nodes, Editor clips, Asset IDs, or MCP requests; each submitted task also records its provider/model identity so polling does not silently follow a later default-provider change.

## Storage

Storage is independently configurable from generation:

- `beatapi` uses the official `https://api.beatapi.io` endpoint with the user's BeatAPI API key. File selection stays local; after generation precheck, supported references go to `POST /v1/files` immediately before task submission.
- Precheck creates a one-time SQLite generation intent that binds project, model, upload count, uploaded URLs, and final task submission. Selecting a file alone never uploads it, and uploaded inputs are not indexed as project assets until BeatAPI accepts the task.
- Users may select `s3` to send generation references to their own public R2/S3-compatible bucket under the same intent rules. Credentials are encrypted in local SQLite rather than read from environment files.

Remote generation providers require public HTTPS media URLs. A custom bucket therefore needs a public base URL, normally an R2 custom domain or public bucket domain.
