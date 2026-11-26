# CLAUDE.md - Development Guide

This file contains development context and commands for working with this codebase.

## Project Overview

GameFeatures - a monorepo with NestJS API and Next.js frontend where gamers submit and vote on feature requests for games. Live demo: https://gamefeatures.vercel.app (API: https://gamefeatures-api.onrender.com).

## Quick Commands

```bash
# Start development (builds libs first, then runs API + Web)
pnpm run dev

# Build all packages
pnpm run build

# Checks (run all of these before every commit; CI runs the same)
pnpm lint              # ESLint, API and web (no auto-fix)
pnpm typecheck         # tsc --noEmit in every package
pnpm test              # API unit tests (Jest) + web tests (Vitest)
pnpm test:e2e          # API e2e tests against real Postgres + Redis (docker compose up -d)
pnpm --filter @game-review/api test:e2e --coverage   # with the 80% line threshold, as CI
pnpm --filter @game-review/api test:e2e test/<name>  # one e2e file
# Turbo caches results; add `-- --force` to re-run. pnpm 8 passes a literal `--` through to
# Jest, so give Jest flags directly as above.

# Production smoke test against any deployment (bash + curl + jq)
pnpm smoke https://gamefeatures.vercel.app

# Database commands
pnpm run db:generate   # Generate Prisma client
pnpm run db:migrate    # Apply/create migrations (prisma migrate dev) - the normal path
pnpm run db:push       # Push schema without a migration - throwaway prototyping only
pnpm run db:seed       # Seed sample data (idempotent; demo_gamer / demo_dev, no admin by default)
pnpm run db:studio     # Open Prisma Studio GUI

# Run individual apps
pnpm --filter @game-review/api dev
pnpm --filter @game-review/web dev

# Build individual libs
pnpm --filter @game-review/shared build
pnpm --filter @game-review/database build
pnpm --filter @game-review/redis build
```

## Architecture Notes

### Monorepo Structure
- **apps/api**: NestJS backend (port 3001); production image in `apps/api/Dockerfile`
- **apps/web**: Next.js 14 frontend (port 3000)
- **libs/shared**: Shared types, constants, enums
- **libs/database**: Prisma schema, migrations, seed
- **libs/redis**: Redis module
- **scripts/**: `smoke-test.sh` (`pnpm smoke`), `check-web-rewrite.mjs` (CI build check)
- **docs/DEPLOY.md**: deploy runbook (Neon + Render + Vercel), env vars, rollback

### Library Build Requirement
Workspace libraries (`@game-review/shared`, `@game-review/database`, `@game-review/redis`) compile to `dist/` and must be built before the API or web app uses them. Turborepo handles this through `dependsOn: ["^build"]` in `turbo.json`.

### Key Design Decisions

1. **CommonJS for libs**: Libraries compile to CommonJS (not ESM) for NestJS compatibility
2. **Upvote-only voting**: ProductHunt-style voting system (no downvotes)
3. **Denormalized counts**: Vote and like counts stored on entities, updated in the same transaction as the row
4. **Redis is a derived index**: Postgres is the source of truth. `RequestRankingService` (`modules/requests/ranking/`) owns the per-game hot/top/new sorted sets: it rebuilds a game's sets from Postgres whenever its "indexed" marker is missing (marker set in the same MULTI as the rebuild, 1-hour TTL) and falls back to Postgres if Redis fails. Nothing else writes those keys, and the seed never touches Redis. Never store anything in Redis that can't be rebuilt.
5. **JWT auth**: Access tokens (15 min, in memory only) + refresh tokens (7 days, HttpOnly cookie) with rotation; refresh tokens are stored as SHA-256 hashes and claimed atomically
6. **Same-origin REST**: the web app proxies `/api/v1/*` to the API (Next.js rewrites from `API_ORIGIN`), so the `SameSite=Lax` refresh cookie works in production. Sockets connect to the API directly (`NEXT_PUBLIC_SOCKET_URL`) and authenticate with the access token.

### Conventions
- **Votes, likes and follows** are idempotent `PUT`/`DELETE` (`/requests/:id/vote`, `/comments/:id/like`, `/follows/users|games/:id`), never toggles. Duplicates are caught via the unique constraint.
- **User data out over HTTP** uses `publicUserSelect` / `selfUserSelect` (`modules/users/user.selects.ts`), never a full user row.
- **Prisma errors** become HTTP codes in `PrismaExceptionFilter` (P2002 → 409, P2025/P2003 → 404); use `isPrismaError(error, 'P2002')` for expected duplicates.
- **Throttling** helpers live in `common/throttle.ts`; the global `ThrottlerGuard` runs before auth guards. `/health` is `@SkipThrottle()`.
- **Logging** uses Nest's `Logger`, not `console`.
- **Web**: one socket per tab (`components/socket-provider.tsx`); access token only in memory (`ApiClient` in `lib/api.ts`); avoid `useSearchParams` in pages (needs a Suspense boundary for `next build`).
- Bug fixes are **test first**: write the regression test, see it fail, then fix.

### Testing
- **Unit tests**: `apps/api/src/**/*.spec.ts` (Jest), `apps/web/src/**/*.test.ts` (Vitest + jsdom).
- **E2E tests**: `apps/api/test/*.e2e-spec.ts` boot the real `AppModule` with `configureApp()` on a random port (`createTestApp()` in `test/utils/`), with RAWG replaced by `FakeRawgAdapter`. Call `resetState(t)` in `beforeEach`: it truncates every table, flushes Redis DB 1, drains BullMQ and clears rate-limit counters. Factories: `createUser`, `createGame`, `createRequest`, `createComment`, `notificationsOf`; helpers `waitFor()` and `test/utils/socket.ts`.
- Test settings come from `apps/api/test/.env.test` (`game_review_test` database, Redis DB 1, high throttle limits). The harness refuses any `DATABASE_URL`/`DIRECT_URL` whose database name doesn't end in `_test`. `globalSetup` runs `prisma migrate deploy` on the test DB.
- A test that needs different env (e.g. a low rate limit) sets `process.env` *before* `createTestApp()` and restores it in `afterAll`.
- Coverage (services, `common/`, ranking) must stay ≥ 80% lines; CI enforces it.

### Database
- PostgreSQL with Prisma ORM
- Schema in `libs/database/prisma/schema.prisma`
- Migrations live in `libs/database/prisma/migrations/`. Every schema change ships as a migration (`db:migrate`); production runs `prisma migrate deploy` when the container starts. `db:push` is for throwaway prototyping only.
- `DATABASE_URL` is the runtime connection, `DIRECT_URL` the one `prisma migrate` uses (on Neon: pooled vs direct; locally the same URL).
- Migrations are forward-only: ship schema changes expand-then-contract so a rolled-back deploy still works with the new schema.
- `prisma migrate dev` refuses non-interactive shells when a change drops data: generate SQL with `prisma migrate diff ... --script`, write the migration folder by hand, then `prisma migrate deploy` (see `20261124034500_hash_refresh_tokens`).
- The Prisma CLI reads `libs/database/.env` (copy it from `libs/database/.env.example`), not the root `.env`.

### Authentication
- Local auth with bcrypt password hashing
- Google OAuth and Twitch OAuth support (off in the demo)
- Access token in memory, refresh token in HTTP-only cookie

### Real-time
- Socket.IO via NestJS WebSockets
- Notifications gateway at `/notifications` namespace
- JWT verification on WebSocket connection; the server joins each user to their private `user:<id>` room, and clients may only join public `request:<id>` rooms

### Deployment
- **API**: Docker image (`apps/api/Dockerfile`, build context = repo root) on Render, described by `render.yaml` (web service + Key Value, Frankfurt). Render deploys only commits whose CI passed. `TRUST_PROXY_HOPS=2` (browser → Vercel → Render).
- **Web**: Vercel, Root Directory `apps/web`; `apps/web/vercel.json` builds through Turborepo so the libs build first. `API_ORIGIN` and `NEXT_PUBLIC_*` are build-time values and must be declared in `turbo.json` (Turborepo 2's strict env mode drops undeclared variables).
- **Postgres**: Neon. The full runbook is `docs/DEPLOY.md`; after any deploy run `pnpm smoke <web url>`.

## Common Issues & Solutions

### "Cannot find module" errors for workspace packages
```bash
# Rebuild the libraries
pnpm run build --filter=@game-review/shared --filter=@game-review/database --filter=@game-review/redis
```

### Database connection issues
```bash
# Ensure Docker containers are running
docker compose up -d

# Verify connection
docker compose ps
```

### Type errors in seed.ts or other files
The project uses strict TypeScript. Ensure explicit types for:
- `response.json()` results (cast with `as` keyword)
- Loop variables that reference themselves
- Optional properties accessed from interfaces

## API Endpoints Summary

All under `/api/v1`; full reference in Swagger.

- **Health**: `/health` - DB and Redis check (used by Render and the web app's wake-up banner)
- **Auth**: `/auth/*` - Register, login, logout, OAuth, token refresh
- **Games**: `/games/*` - List, details, requests (`?sort=hot|top|new`), RAWG search/import
- **Requests**: `/requests/*` - Feature requests, `PUT`/`DELETE` vote, status (game developer)
- **Comments**: `/requests/:id/comments`, `/comments/:id/like` - Threaded comments, likes
- **Users & follows**: `/users/*`, `/follows/*` - Profiles, feed, following
- **Notifications**: `/me/notifications` - List, mark read; `/me/device-tokens` for push
- **Admin**: `/admin/*` - Dev access management

## Swagger Docs

Available at http://localhost:3001/docs when the API is running (live: https://gamefeatures-api.onrender.com/docs).
