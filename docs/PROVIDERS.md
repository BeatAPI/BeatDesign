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

The source catalog was reconciled against `GET /v1/media/models` on 2026-10-30. It offers the current image and video models through a shared API key, except HappyHorse and Kling Motion Control, which are retired in BeatDesign. Retired model identities remain readable for existing project history and polling, but cannot be selected or submitted for new generation. Existing cards must be switched explicitly to another model. A catalog entry is a supported local integration, not proof of a successful paid generation.

The current source exposes these logical models:

- Image: Nano Banana, Nano Banana 2, Nano Banana 2.1, Nano Banana 2 Lite, Nano Banana Pro, GPT Image 2, GPT Image 2.5 Flare, GPT Image 2.5 Sunburst, Seedream 5 Pro, Seedream 5 Lite, Grok Imagine Image 2.0 and Qwen Image 2.1.
- Video: MiniMax H3, H3 Fast, H3 Normal, H3 Max and H3 Max Turbo; Seedance 2, 2 Fast, 2 Mini and 2.5; Veo 3.1; Kling 3 and Kling 4; Grok Imagine Video 1.5; Wan 3.0 and Wan 3.0 Prime. Kling 3 is sent to BeatAPI as `kling-v3` while its existing logical ID remains `kling-3` for project compatibility.

This is a dated source snapshot, not a live-synchronized catalog. Model availability can change; check the live endpoint before a future update. The current changes are not part of the published v0.2.5 package.

The Composer exposes a supported subset of each model's upstream controls. MiniMax H3 Max / Max Turbo use dedicated first/last-frame slots; most other models use explicit prompt directives for frames and generic references otherwise. Kling 4 currently accepts generic references, translates BeatDesign reference mentions to BeatAPI syntax, and does not expose upstream elements or multi-frame controls. Account access, funds, and model availability remain subject to BeatAPI.

Video Analysis is exposed as a stable BeatAPI workflow with Standard and Deep depth controls. The Workspace uploads one MP4/MOV input, submits the analysis task, polls `GET /v1/tasks/:id`, and stores the returned report text and usage in the local project history. Provider-specific Gemini routing remains private to BeatAPI.

An API with a different request or polling contract needs its own adapter. Forks can register one in `src/config/generation-providers.ts`, bind only the logical models they support, and change `ACTIVE_GENERATION_PROVIDER_ID` in the same file. BeatAPI remains the upstream default; an unknown configured id fails explicitly so it cannot accidentally submit a task to another provider. This repository does not ship placeholder KIE, Vidu, Evolink, Gemini, Fal, Replicate, or payment-provider integrations.

A custom provider definition owns adapter construction, readiness checks, parameter validation, model bindings, upstream model names, and upload paths. Keep the binding metadata browser-safe and wrap server implementations in TanStack `createServerOnlyFn`, as the BeatAPI provider does, so model discovery cannot import the database or credentials into the browser. Provider credentials must stay server-side. Switching providers does not change Canvas nodes, Editor clips, Asset IDs, or MCP requests; each submitted task also records its provider/model identity so polling does not silently follow a later default-provider change.

## Storage

Storage is independently configurable from generation:

- `beatapi` uses the official `https://api.beatapi.io` endpoint with the user's BeatAPI API key. File selection stays local; after generation precheck, supported references go to `POST /v1/files` immediately before task submission.
- Precheck creates a one-time SQLite generation intent that binds project, model, upload count, uploaded URLs, and final task submission. Selecting a file alone never uploads it, and uploaded inputs are not indexed as project assets until BeatAPI accepts the task.
- Users may select `s3` to send generation references to their own public R2/S3-compatible bucket under the same intent rules. Credentials are encrypted in local SQLite rather than read from environment files.

Remote generation providers require public HTTPS media URLs. A custom bucket therefore needs a public base URL, normally an R2 custom domain or public bucket domain.
