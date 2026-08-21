# Open-source release scope

This repository contains BeatDesign only. The separate BeatAPI SaaS Template is not part of this codebase.

Included: homepage, projects, Studio, Canvas, provider configuration, supported model registry, generation lifecycle, uploads, assets, local history, i18n, SQLite/D1 persistence, tests, and deployment examples.

Excluded: authentication, login, accounts, payments, subscriptions, credits, API-key issuing, invitations, RBAC, admin, support tickets, CMS, email delivery, and unrelated AI-provider adapters.

Release verification requires a clean install, schema creation, typecheck, test, i18n check, production build, and local route smoke test. A real paid BeatAPI generation is a separate credentialed end-to-end check.
