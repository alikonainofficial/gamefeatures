# syntax=docker/dockerfile:1
#
# Production image for the GameFeatures API.
# Build from the repo root (the build context must be the whole monorepo):
#   docker build -f apps/api/Dockerfile -t gamefeatures-api .
# On start it applies pending migrations (prisma migrate deploy, via DIRECT_URL), then runs
# the API. Required env: DATABASE_URL, DIRECT_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET.

ARG NODE_IMAGE=node:20-slim

# ---------------------------------------------------------------------------
# base: Node 20 + pnpm (version pinned by "packageManager" in package.json) + OpenSSL,
# which Prisma's query engine (binaryTarget debian-openssl-3.0.x) links against.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# build: full install (dev deps included), generate the Prisma client, compile the libs + API.
# ---------------------------------------------------------------------------
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate
RUN pnpm exec turbo run build --filter=@game-review/api...

# ---------------------------------------------------------------------------
# prod-deps: production dependencies of the API and the libs it uses, nothing else
# (no Next.js, no Jest). apps/web/package.json is left out on purpose: with it present, pnpm
# installs the web app's dependencies too (~400 MB of Next.js). The prisma CLI is a production
# dependency of @game-review/database so that `migrate deploy` can run in the container.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY libs/shared/package.json libs/shared/
COPY libs/redis/package.json libs/redis/
COPY libs/database/package.json libs/database/
COPY libs/database/prisma libs/database/prisma
RUN pnpm install --prod --frozen-lockfile --filter "@game-review/api..."
RUN pnpm --filter @game-review/database exec prisma generate

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=prod-deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=prod-deps /app/libs/shared/package.json libs/shared/
COPY --from=prod-deps /app/libs/redis/package.json libs/redis/
COPY --from=prod-deps /app/libs/database/package.json libs/database/
COPY --from=prod-deps /app/libs/redis/node_modules libs/redis/node_modules
COPY --from=prod-deps /app/libs/database/node_modules libs/database/node_modules
COPY --from=prod-deps /app/libs/database/prisma libs/database/prisma
COPY --from=build /app/libs/shared/dist libs/shared/dist
COPY --from=build /app/libs/redis/dist libs/redis/dist
COPY --from=build /app/libs/database/dist libs/database/dist

COPY --from=prod-deps /app/apps/api/package.json apps/api/
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist

# Files stay root-owned (read-only for the app); the process runs as the unprivileged `node` user.
USER node
EXPOSE 3001

# `exec` makes node PID 1, so it receives Render's SIGTERM directly and shuts down gracefully
# (app.enableShutdownHooks). Migrating on start is safe because the free tier runs one instance.
CMD ["sh", "-c", "./libs/database/node_modules/.bin/prisma migrate deploy --schema libs/database/prisma/schema.prisma && exec node apps/api/dist/main.js"]
