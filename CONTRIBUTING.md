# Contributing

Thanks for helping improve BeatDesign.

## Before opening a change

1. Keep the repository focused on the open-source workbench: Home, projects, Studio, Canvas, assets, generation history, provider configuration, and storage adapters.
2. Do not add login, payments, subscriptions, credits, admin, RBAC, or other SaaS Template modules.
3. Open an issue before introducing a new generation provider, database, or major product workflow.

## Local verification

Use Node.js 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.development
pnpm db:push
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm build
```

Add or update tests for behavior changes. Add user-facing copy to both `messages/en.json` and `messages/zh.json`. Never include API keys, local databases, generated uploads, or deployment credentials.

## Pull requests

Keep each pull request focused, explain the user-visible outcome, list verification performed, and include screenshots for UI changes. By contributing, you agree that your contribution is licensed under Apache-2.0.
