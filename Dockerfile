FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS deps
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/db-setup.mjs scripts/db-setup.mjs
COPY src/config/db/schema.sqlite.ts src/config/db/schema.sqlite.ts
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm db:push
RUN pnpm build

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/data ./data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
