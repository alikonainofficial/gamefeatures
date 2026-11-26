# GameFeatures: Improvement Plan

**Goal:** turn GameFeatures from a single-commit prototype into a project that builds, has tests, runs CI on every push, and has a free public demo, fixing the bugs and security holes found in the November 2026 review along the way.

**Branch:** `improvement-plan` (this file lives there). Make every commit on this branch; never push to `main`.

---

## How to use this plan (instructions for the Claude Code session)

1. Work through the steps **in order**, starting from the first unticked box under **Progress**. Read **Handoff notes** (right after Progress) first: they record the environment, commands and conventions earlier sessions established, and where later steps' text is out of date. Each step lists *Why*, *Do*, *Done when* and a *Commit* message.
2. **One commit per step**, using the commit message given (Conventional Commits). Before each commit run the checks that exist so far (from step 1.3 onward: `pnpm lint && pnpm typecheck && pnpm test`, and from step 1.4 onward also `pnpm test:e2e`). Don't commit a red build.
3. After finishing a step, tick its box in the **Progress** list below and include that PLAN.md change in the same commit.
4. Fix bugs **test first**: from Phase 2 on, write the regression test, watch it fail, then fix.
5. If the code shows a step is wrong or out of date (a file moved, an API changed), take the smallest sensible route, add a short entry under **Deviations log** at the bottom, and carry on. Stop and ask the user only for steps marked **🧑 MANUAL** or for anything irreversible (creating accounts, entering secrets, deploying, changing repo settings, force-pushing).
6. **Never commit secrets.** `.env` files stay git-ignored; document new variables in `.env.example`.
7. **No major version upgrades** (stay on Next 14, NestJS 10, Prisma 5, pnpm 8, Node 20). Patch/minor bumps only if a step needs them.
8. Keep the user in the loop: at the end of each phase, print a 3–5 line summary of what changed and how it was verified.

---

## Progress

- [x] 0.1 Get a clean local baseline (install, generate, build, run)
- [x] 0.2 Fix the Next.js production build (`useSearchParams` without Suspense)
- [x] 0.3 Commit an initial Prisma migration
- [x] 1.1 Add ESLint configs and non-fixing lint scripts
- [x] 1.2 Add `typecheck` scripts and a shared `configureApp()`
- [x] 1.3 API unit-test setup (Jest)
- [x] 1.4 API end-to-end test harness (real Postgres + Redis)
- [x] 1.5 GitHub Actions CI
- [x] 2.1 Fix query validation that rejects `sort`, `search` and `unread` (400s)
- [x] 2.2 Fix the web client never sending the access token, and add refresh-on-401
- [x] 2.3 Fix the Redis ranking index (missing requests, wrong "new" order)
- [x] 2.4 Map Prisma errors to HTTP codes (no more 500s for 404/409 cases)
- [x] 2.5 Idempotent, race-safe votes, likes and follows
- [x] 2.6 Consistent username validation on profile update
- [x] 3.1 Stop leaking email, OAuth IDs and isAdmin on public profiles
- [x] 3.2 Restrict WebSocket room subscriptions
- [x] 3.3 Turn rate limiting on
- [x] 3.4 Harden refresh tokens
- [x] 3.5 Harden OAuth (token in URL, unverified-email account linking)
- [x] 3.6 Timeouts on outbound RAWG calls
- [x] 3.7 Safe, realistic seed data
- [x] 4.1 Live notifications in the UI
- [x] 4.2 Live vote counts
- [x] 5.1 Fill API coverage to target
- [x] 5.2 Web unit tests for the API client
- [x] 6.1 API production readiness (health, proxy, shutdown, Neon)
- [x] 6.2 Dockerfile for the API
- [x] 6.3 Same-origin API through Next.js rewrites
- [x] 6.4 Demo-mode UX (cold-start banner, demo logins, OAuth hidden)
- [x] 6.5 Render blueprint and deploy runbook
- [x] 6.6 Smoke-test script
- [x] 6.7 🧑 MANUAL: create accounts, deploy, seed, smoke-test
- [x] 7.1 README, CLAUDE.md and LICENSE

---

## Handoff notes (read before continuing)

Written at the end of the first session (2026-11-24); updated at the end of the second (2026-11-25) and third (2026-11-26). **All steps are done** (0.1–7.1). The demo is live at https://gamefeatures.vercel.app (API https://gamefeatures-api.onrender.com); Vercel's and Render's production branch is `improvement-plan`. Remaining for the user: screenshots/GIF for the README (placeholder marked `🧑 TODO`), and merging `improvement-plan` into `main` when ready (then switch Vercel's production branch and the Render service's branch back to `main`).

**Second-session notes:** Docker worked in that workspace (`dockerd` had to be started by hand; `docker compose up -d` then pulled fine). `docker build` there needed `--build-arg NODE_IMAGE=<node:20-slim + the proxy CA>` because the egress proxy re-signs TLS; on a normal machine and in CI the default `node:20-slim` works. Test counts now: 39 API unit, 23 web, 184 in the e2e coverage run (96.3% lines). For 7.1, the README env table also needs `LOG_CLIENT_IP`, `API_ORIGIN`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_DEMO_PASSWORD`, `NEXT_PUBLIC_OAUTH_PROVIDERS`, and should link `docs/DEPLOY.md`; CLAUDE.md should mention `pnpm smoke`, the Docker image and `render.yaml`.

### Environment and local setup

- **Repo setup on a fresh machine/session:** `git fetch origin && git checkout improvement-plan && git pull`, `pnpm install --frozen-lockfile`, then copy the env files: `cp .env.example .env`, `cp apps/api/.env.example apps/api/.env`, `cp apps/web/.env.example apps/web/.env.local`, **and** `cp libs/database/.env.example libs/database/.env` (the Prisma CLI reads `libs/database/.env`, not the root `.env`). Then `pnpm db:generate && pnpm db:migrate && pnpm db:seed`.
- **Postgres and Redis:** use `docker compose up -d` when Docker works. In the cloud workspace used so far, Docker Hub refused anonymous image pulls (`429 Too Many Requests`), so Postgres 16 and Redis 7 ran natively on the same ports and credentials (Postgres `postgres:postgres@localhost:5432`, DB `game_review`; Redis `localhost:6379`). If you have to do the same, start Redis with `redis-server --port 6379 --daemonize yes --save "" --dir /tmp` so it never writes `dump.rdb` into the repo. Tell the user if Docker isn't running (they asked to be told).
- **Docker Hub matters for 6.2:** `docker build` needs `node:20-slim`. If pulls are refused again, don't mark 6.2 done without a successful build; tell the user and ask them to run the build/run check on their machine (or retry later).
- **Network:** `pnpm db:generate` downloads Prisma engines from `binaries.prisma.sh`, and `next build` fetches Google Fonts. Both are reachable now; if a session's network policy blocks them, ask the user to allow those hosts rather than working around it.
- **Node:** CI pins Node 20 (plan constraint). The workspace had Node 22; that's fine locally.

### Commands and gotchas

- **Checks before every commit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` (and `pnpm build` when a step touches build config). Root `pnpm test` runs the API Jest unit tests **and** the web Vitest tests. Turbo caches results; add `-- --force` to re-run.
- **pnpm 8 passes a literal `--` through to Jest.** Pass Jest flags directly: `pnpm --filter @game-review/api test:e2e --coverage`, or a single file: `pnpm --filter @game-review/api test:e2e test/<name>`. Equivalent: `cd apps/api && npx jest --config ./test/jest-e2e.json test/<name>`.
- **Coverage:** `apps/api/test/jest-e2e.json` runs `test/**/*.e2e-spec.ts` **and** `src/**/*.spec.ts`, collects coverage from services, `common/**` and `ranking/**`, and enforces `lines: 80` (currently ~95.6%, 167 tests). CI runs it with `--coverage`.
- **E2E harness** (`apps/api/test/utils/`): `createTestApp()` boots the real `AppModule` with `configureApp()`, listens on a random port and swaps RAWG for `FakeRawgAdapter` (`t.rawg.add(...)`). `resetState(t)` truncates every table, flushes Redis DB 1, drains BullMQ and clears the throttler's in-memory counters; it refuses databases whose name doesn't end in `_test`. Factories: `createUser`, `createGame`, `createRequest`, `createComment`, `notificationsOf`. Also `waitFor()` for queued effects and `socket.ts` (`connectedSocket`, `collect`, `settle`, `closeAllSockets`). Test defaults are in `apps/api/test/.env.test` (high throttle limits; `rate-limit.e2e-spec.ts` lowers `AUTH_THROTTLE_LIMIT` itself).
- **Web tests:** Vitest 4.1 + jsdom 28 (the newest majors need Node 22), files `apps/web/src/**/*.test.ts`, config `apps/web/vitest.config.mts`.
- **Prisma migrations that drop data:** `prisma migrate dev` refuses non-interactive shells. Generate SQL with `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <empty db> --script`, write `prisma/migrations/<timestamp>_<name>/migration.sql` by hand, then `prisma migrate deploy`. See `20261124034500_hash_refresh_tokens`.
- **Manual UI checks** were done with headless Chrome (`/usr/bin/google-chrome`) driven by `playwright-core`, installed in a temp directory outside the repo (`npm i playwright-core` there). Flow: `pnpm build`, then run `node dist/main.js` from `apps/api` and `npx next start -p 3000` from `apps/web`. When stopping, also kill `next-server` (`pkill -f next-server`): a leftover one keeps serving the old build and its JS chunks 400. Never `pkill -f` a pattern that also appears in your own shell command (it kills the shell). Demo logins: `demo_gamer@demo.gamefeatures.dev` / `demo_dev@demo.gamefeatures.dev`, password `try-the-demo` (the `SEED_DEMO_PASSWORD` default).
- **Push and CI:** `git -c push.negotiate=true push origin improvement-plan`, then `gh run list -R alikonainofficial/gamefeatures --branch improvement-plan --limit 1` and `gh run view <id> -R alikonainofficial/gamefeatures`. Push at the end of each phase; if CI fails, fix before moving on.

### Conventions established (keep following them)

- A fix to an earlier step gets its **own** `fix(...)` commit plus a Deviations log entry (examples: `fix(build): keep API build output at dist/main.js`, `fix(api): accept seeded request IDs in socket room names`).
- Bug fixes are test-first; features get e2e coverage of the server side plus a browser check of the UI.
- **Redis is a derived index.** `RequestRankingService` owns the request sorted sets (rebuild-on-missing marker with a 1-hour TTL, Postgres fallback). Nothing else writes those keys; the seed never touches Redis.
- **User data out over HTTP** uses `publicUserSelect` / `selfUserSelect` (`modules/users/user.selects.ts`), never a full user row.
- **Prisma errors** become HTTP codes in `PrismaExceptionFilter` (P2002 → 409, P2025/P2003 → 404); use `isPrismaError(error, 'P2002')` (`common/prisma/is-prisma-error.ts`) to handle expected duplicates.
- **Votes, likes and follows** are idempotent `PUT`/`DELETE` (`/requests/:id/vote`, `/comments/:id/like`, `/follows/users|games/:id`); the old `POST` toggles were removed.
- **Throttling** helpers live in `common/throttle.ts` (`positiveInt`, `defaultThrottlers`, `AUTH_THROTTLE`, `IMPORT_THROTTLE`, `userOrIpTracker`). The global `ThrottlerGuard` runs before auth guards.
- **Web:** the access token lives only in memory (`ApiClient` in `lib/api.ts`, wired to the auth store with `configureAuth`). One socket per tab in `components/socket-provider.tsx`. Unread count and toasts are in `lib/stores/notification-store.ts`. Avoid `useSearchParams` in pages (it needs a Suspense boundary for `next build`); read `window.location` in an effect instead, as the login page does.
- Two `next lint` warnings already existed before this work (an `<img>` on the request page and a hook-deps warning in `comment-section.tsx`); they're warnings, not errors.

### Where the remaining steps' text is out of date

- **6.1**
  - `trust proxy` from `TRUST_PROXY_HOPS` already exists (`app.setup.ts`, 3.3), so 6.1 only decides the production value; 6.7 verifies it. `@SkipThrottle()` the health route.
  - **`DIRECT_URL` must go everywhere `DATABASE_URL` is used for migrations:** `apps/api/test/.env.test` (the e2e `globalSetup` runs `prisma migrate deploy`), both env blocks in `.github/workflows/ci.yml` (the migrate step and the e2e step), and all three `.env.example` files. `seed.e2e-spec.ts` runs the seed with `process.env`, so it inherits it.
  - `console.log`/`console.error` to replace with Nest `Logger`: `main.ts`, `notifications.gateway.ts`, `fcm.service.ts`. `fcm.service.spec.ts` currently silences `console.log`/`console.error`; update it when FCM switches to `Logger`.
  - `apps/api/tsconfig.build.json` exists (it keeps the build output at `dist/main.js`); CI fails if that file is missing.
- **6.3**
  - The socket URL is the `SOCKET_URL` constant in `apps/web/src/components/socket-provider.tsx` (`hooks/use-socket.ts` only re-exports `useSocket`). The REST base URL is `API_URL` in `apps/web/src/lib/api.ts`.
  - `WEB_URL` is read in three places: `app.setup.ts` (`enableCors`), `notifications.gateway.ts` (decorator CORS, from `process.env` at import), and `auth.controller.ts` `finishOAuth()` (the OAuth redirect target). With a comma-separated list, OAuth should redirect to the **first** entry.
  - The refresh cookie is `refreshToken`, `httpOnly`, `sameSite: 'lax'`, `secure` in production, with no explicit `path`.
- **6.4:** the demo accounts and password already exist (3.7). The login page already shows `?error=account_exists` / `email_required` messages (3.5); keep them when adding the demo buttons.
- **6.5:** besides the vars listed in 6.5, consider `AUTH_THROTTLE_LIMIT` and `RAWG_TIMEOUT_MS` (both have defaults). The `SEED_*` vars aren't needed on Render (the seed runs from the user's machine in 6.7). Note in the runbook: `/auth/refresh` is rate-limited, so a wrong `TRUST_PROXY_HOPS` would make all visitors share one limit.
- **6.6:** votes are `PUT`/`DELETE /api/v1/requests/:id/vote`, returning `{ voted, voteCount }`. Seeded game slugs include `portal-2` and `grand-theft-auto-v`. Login/register/refresh allow 10 requests per minute per IP by default, so re-running the smoke test back-to-back can hit 429.
- **7.1:** the README already has a **Known limitations** section (3.4) and a **Demo accounts** section that replaced the admin table (3.7); expand them rather than adding duplicates. Current test counts: 33 API unit, 15 web, 167 in the e2e coverage run.

---

## Context

**Stack:** pnpm 8 + Turborepo monorepo. `apps/api` is NestJS 10 with Prisma 5 (Postgres), ioredis, BullMQ, Socket.IO, Passport (JWT, Google, Twitch) and Swagger. `apps/web` is Next.js 14 (App Router) with Tailwind and zustand. `libs/shared`, `libs/database` (Prisma schema + seed) and `libs/redis`.

**State before this plan:** one commit, **no tests** (Jest is configured but there are no `*.spec.ts` files, and `test:e2e` points at a `test/jest-e2e.json` that doesn't exist), **no CI**, **no ESLint config** anywhere (so `pnpm lint` can't pass), no Prisma migrations (`db push` only), and no deployment.

### Review findings (verified November 2026)

Severity: 🔴 broken for users or a security hole · 🟠 wrong or risky · 🟡 quality.

| # | Sev | Finding | Evidence | How it was verified |
|---|-----|---------|----------|---------------------|
| F1 | 🔴 | Every game page's request list returns **400**. Game search and the notifications `unread` filter also return 400. With `forbidNonWhitelisted: true`, `@Query() pagination: PaginationDto` rejects any extra query key (`sort`, `search`, `unread`). | `requests.controller.ts:57-58`, `games.controller.ts:24`, `notifications.controller.ts:29-30`, `main.ts` ValidationPipe; web sends `?sort=` in `request-list.tsx:53` and `trending/page.tsx:59` | Ran Nest's `ValidationPipe` against `PaginationDto`: `{sort:'top'}` gives 400 "property sort should not exist", and the same happens for `search` |
| F2 | 🔴 | **The web app never sends the access token**, so login/register fail at `GET /auth/me` (401) and every authenticated action fails. `api.ts` reads `localStorage['auth-storage']`, but the zustand store doesn't use `persist`, so nothing is ever written there. There's no refresh on 401 either (tokens last 15 minutes). | `apps/web/src/lib/api.ts:10-20`, `lib/stores/auth-store.ts` (no `persist`) | Code reading; grep finds no `persist` or `auth-storage` writer |
| F3 | 🔴 | **`next build` fails**: `useSearchParams()` isn't wrapped in `<Suspense>` on `/auth/callback` and `/games`. The web app can't be deployed. | `app/auth/callback/page.tsx:10`, `app/games/page.tsx:31` | Ran `next build` (with the Google-font fetch stubbed): prerender errors on both pages |
| F4 | 🔴 | **Requests disappear from game lists.** Redis sorted sets are the list source once *any* member exists, but the seed (and any Redis restart) leaves them empty or partial. After the first vote, only the voted request is listed and `total` is 1. | `requests.service.ts` `findByGame` + `getFromRedisCache`; `seed.ts` never touches Redis; `votes.service.ts` `updateRedisCache` | Code reading (seed creates 2 GTA requests; voting on one adds only that ID to the sets) |
| F5 | 🟠 | "New" sort is **oldest-first** from Redis (`zrange`) but newest-first in the DB fallback. | `requests.service.ts:281-287` | Code reading |
| F6 | 🟠 | Vote, like and follow toggles do a read and then a write, so concurrent clicks hit unique constraints and return **500**. Upvoting a missing request also returns 500 (FK error). There's no Prisma error mapping anywhere. | `votes.service.ts` `toggleVote`, `comments.service.ts` `toggleLike`, `follows.service.ts`; no `APP_FILTER`/exception filter | Code reading + schema `@@unique` constraints |
| F7 | 🔴 | **PII leak:** public `GET /users/:username` returns email, googleId, twitchId and isAdmin for any user. | `users.service.ts:22-50` (`findByUsername` spreads the whole user) | Code reading |
| F8 | 🔴 | **Any socket can join any room**, including `user:<someoneElse>`, and receive that user's private notifications. | `notifications.gateway.ts:82-86` | Code reading |
| F9 | 🟠 | Rate limiting is configured but **not applied**: `ThrottlerModule` is registered without `ThrottlerGuard` as `APP_GUARD`, so login can be brute-forced. | `app.module.ts:25`; grep finds no `ThrottlerGuard`/`APP_GUARD` | grep |
| F10 | 🟠 | Refresh tokens are stored in plaintext. Two logins by the same user in the same second produce **identical** JWTs (same payload and `iat`), so `token @unique` fails and returns 500. | `auth.service.ts` `generateTokens`; schema `RefreshToken.token @unique` | Code reading |
| F11 | 🟠 | OAuth puts the access token in the query string (`?token=`), where it ends up in history and logs. Twitch and Google logins **auto-link to an existing account by email** without checking that the email is verified. | `auth.controller.ts:103,120`; `auth.service.ts` `validateOAuthUser` | Code reading |
| F12 | 🟠 | `PATCH /users/me` accepts any username up to 100 chars (register enforces 3–30 `[a-zA-Z0-9_]`); a duplicate returns 500. | `users/dto/update-user.dto.ts` | Code reading |
| F13 | 🟠 | The seed creates an admin with password `admin123` and the README publishes it. Seeded `voteCount`s (42, 128) don't match the actual Vote rows. | `seed.ts:136,151`, `README.md:115-116` | Code reading |
| F14 | 🟡 | The README advertises real-time notifications and live votes, but `useSocket` is never used in the UI and `sendVoteUpdate` is never called. | `hooks/use-socket.ts` (no importers); `notifications.gateway.ts` `sendVoteUpdate` (no callers) | grep |
| F15 | 🟡 | Dead code: `hoursSinceCreation` and `HOT_SCORE_DECAY_HOURS` are unused (the Reddit-style formula decays through its creation-time term, so nothing is actually broken). Hot score is duplicated in two services. | `votes.service.ts:6,114`, `requests.service.ts` | Code reading |
| F16 | 🟡 | RAWG `fetch` calls have no timeout. Any logged-in user can import any number of games. | `games/game-api/rawg.adapter.ts` | Code reading |
| F17 | 🟡 | README says `cd game-review` (the repo is `gamefeatures`) and "MIT" but there's no LICENSE file. API `lint` script uses `--fix`, which CI must not do. | `README.md`, `apps/api/package.json` | Code reading |

> The API build couldn't be compiled during review (Prisma's engine download was blocked in that sandbox). Step 0.1 does that first on a real machine.

### Constraints

- **Hosting must stay free** (user requirement). Chosen stack (checked November 2026):
  - **Web:** Vercel Hobby, which is for personal, non-commercial use; a portfolio demo fits.
  - **API:** Render free web service (Docker). It spins down after 15 minutes without HTTP requests or WebSocket messages and takes about a minute to wake. 750 free instance hours per workspace per month.
  - **Postgres:** Neon Free: 1 GB per project, 100 CU-hours per project per month, scales to zero after 5 minutes idle, no expiry. *(Render's free Postgres expires after 30 days, so it isn't used.)*
  - **Redis:** Render free Key Value: one per workspace, **in-memory only, data lost on restart**. That's fine *after* step 2.3, because Redis becomes a rebuildable index and BullMQ jobs are short-lived.
- OAuth (Google/Twitch) and FCM push stay **off in the demo**. The code paths remain and are hardened (3.5), but no credentials are configured.

---

## Phase 0: Baseline

### 0.1 Get a clean local baseline
**Why:** nothing has been verified to build yet.
**Do:**
1. `pnpm install`, `cp .env.example .env` (and `apps/api/.env`, `apps/web/.env.local` from their examples), `docker compose up -d`, `pnpm db:generate`, `pnpm db:push`, `pnpm db:seed`.
2. `pnpm build`. Fix **only** what stops the libs and API compiling (for example implicit-`any` errors, if they appear once the Prisma client is generated). No refactors. The web build is expected to fail on F3; that's step 0.2.
3. `pnpm dev`, then open http://localhost:3000 and http://localhost:3001/docs. Confirm F1 and F2 by hand (open a game page; try logging in) and note the results in the Deviations log.
**Done when:** the libs and API build; API and web start in dev mode.
**Commit:** `chore: fix build errors and verify local baseline`

### 0.2 Fix the Next.js production build (F3)
**Do:** in `app/auth/callback/page.tsx` and `app/games/page.tsx`, move the component that calls `useSearchParams()` into a child and wrap it in `<Suspense fallback={…}>` in the page (the pattern from the Next 14 docs).
**Done when:** `pnpm --filter @game-review/web build` passes; CI builds the web app.
**Commit:** `fix(web): wrap useSearchParams in Suspense so next build succeeds`

### 0.3 Commit an initial Prisma migration
**Why:** production needs `prisma migrate deploy`; there are no migrations.
**Do:** `pnpm --filter @game-review/database exec prisma migrate dev --name init` against an empty local DB. Commit `libs/database/prisma/migrations/`. Update README/CLAUDE.md so `db:migrate` is the normal path and `db:push` is only for prototyping.
**Done when:** `prisma migrate deploy` on an empty DB recreates the full schema.
**Commit:** `chore(db): add initial Prisma migration`

---

## Phase 1: Tooling, tests, CI (before touching behaviour)

### 1.1 ESLint configs and non-fixing lint scripts
**Why:** no ESLint config exists (F17); `lint` can't pass, and it auto-fixes.
**Do:**
- `apps/api/.eslintrc.cjs`: `@typescript-eslint` recommended + `prettier`, `parserOptions.project` pointing at `tsconfig.json`, env node + jest. Add a `.prettierrc` (single quotes, trailing commas, 100 cols, matching the current code style).
- `apps/web/.eslintrc.json`: `{"extends": "next/core-web-vitals"}`; add `eslint` + `eslint-config-next@14` devDeps to web.
- Scripts: `lint` = check only; `lint:fix` = with `--fix`. Fix the lint errors that come up (small, mechanical changes only).
**Done when:** `pnpm lint` passes from the root with no `--fix`.
**Commit:** `chore(lint): add ESLint configs and non-fixing lint scripts`

### 1.2 `typecheck` scripts and a shared `configureApp()`
**Do:**
- Add `"typecheck": "tsc --noEmit"` to api, web and each lib; add a `typecheck` task to `turbo.json` (dependsOn `^build`) and a root script.
- Create `apps/api/src/app.setup.ts` exporting `configureApp(app: INestApplication)`, which applies helmet, cookie-parser, CORS, `setGlobalPrefix('api/v1')` and the ValidationPipe. `main.ts` calls it, and so will the tests, so tests run the real pipeline.
**Done when:** `pnpm typecheck` passes; app behaviour unchanged.
**Commit:** `chore: add typecheck scripts and shared app configuration`

### 1.3 API unit-test setup
**Do:** keep Jest (already in devDeps). Make sure `pnpm --filter @game-review/api test` runs `src/**/*.spec.ts`. Add one real unit test to prove the wiring: extract the hot-score formula into `apps/api/src/modules/requests/ranking/hot-score.ts` (a pure function, with the Reddit epoch as a named constant) and test that more votes rank higher, newer ranks higher at equal votes, and 0 votes doesn't throw. Add a root `test` script through turbo.
**Done when:** `pnpm test` runs and passes.
**Commit:** `test(api): set up unit tests with hot-score coverage`

### 1.4 API end-to-end test harness (real Postgres + Redis)
**Why:** most bugs here live between Nest, Prisma, Redis and HTTP, so mocks would hide them.
**Do:**
- `apps/api/test/jest-e2e.json`: `rootDir ".."`, `testRegex "test/.*\\.e2e-spec\\.ts$"`, `testEnvironment node`, `globalSetup`, `setupFilesAfterEnv`, `maxWorkers: 1`.
- Test env: `DATABASE_URL=…/game_review_test`, `REDIS_URL=redis://localhost:6379/1` (separate DB index), dummy JWT secrets, `NODE_ENV=test`. Put defaults in `apps/api/test/.env.test` (committed; no real secrets).
- `test/global-setup.ts`: run `prisma migrate deploy` against the test DB.
- `test/utils/`:
  - `create-test-app.ts`: `Test.createTestingModule({ imports: [AppModule] })`, override `RawgAdapter` with an in-memory fake, call `configureApp`, `init()`, and return `{ app, prisma, redis, http }`.
  - `reset.ts`: `TRUNCATE … RESTART IDENTITY CASCADE` on all tables, `redis.flushdb()`, drain BullMQ queues.
  - `factories.ts`: `createUser({ isAdmin, userType })` (registers via HTTP and returns the token), `createGame()`, `createRequest()`.
  - `wait-for.ts`: polls an async assertion (for BullMQ-driven notifications; 5 s timeout).
- Close the app and all Redis/BullMQ connections in `afterAll` so Jest exits without `--forceExit`.
- First spec, `test/health-and-auth.e2e-spec.ts`: register → `GET /auth/me` → 200 with matching username.
**Done when:** `docker compose up -d && pnpm --filter @game-review/api test:e2e` passes locally twice in a row.
**Commit:** `test(api): add end-to-end harness against real Postgres and Redis`

### 1.5 GitHub Actions CI
**Do:** `.github/workflows/ci.yml`:
- Triggers: `push` to `main` and `improvement-plan`, all `pull_request`s. `concurrency` group per ref with `cancel-in-progress`.
- One job on `ubuntu-latest` with **service containers** `postgres:16-alpine` (healthcheck `pg_isready`) and `redis:7-alpine` (healthcheck `redis-cli ping`).
- Steps: checkout → `pnpm/action-setup` (version from `packageManager`) → `actions/setup-node` (Node 20, pnpm cache) → `pnpm install --frozen-lockfile` → `pnpm db:generate` → create the test DB and `migrate deploy` → `pnpm lint` → `pnpm typecheck` → `pnpm build` → `pnpm test` → `pnpm --filter @game-review/api test:e2e -- --coverage` → upload `coverage/` as an artifact.
- Use the current major versions of each action (check their READMEs). No secrets needed.
- Add a CI status badge to the top of README.md.
**Done when:** the workflow is green on the branch.
**Commit:** `ci: add GitHub Actions pipeline with Postgres and Redis services`

---

## Phase 2: Critical bug fixes (test first)

### 2.1 Query validation rejects `sort`, `search`, `unread` (F1)
**Do:**
- In `apps/api/src/common/dto/` or per module, add query DTOs that **extend `PaginationDto`**:
  - `ListGamesQueryDto` with `search?: string` (`@IsOptional @IsString @MaxLength(100)`).
  - `ListRequestsQueryDto` with `sort: 'hot' | 'top' | 'new' = 'hot'` (`@IsOptional @IsIn([...])`).
  - `ListNotificationsQueryDto` with `unread?: boolean`. ⚠️ Don't rely on `enableImplicitConversion` for booleans: `Boolean('false') === true`. Use `@Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)` + `@IsBoolean() @IsOptional()`.
- Each controller method takes **one** `@Query() query: XxxQueryDto`. Update the Swagger decorators.
**Tests (e2e):** `GET /games?search=portal&limit=8` → 200 and filtered; `GET /games/:slug/requests?sort=top&page=1&limit=10` → 200; the same for `hot` and `new`; `GET /me/notifications?unread=false` returns read *and* unread; `?unread=true` returns only unread; `?sort=bogus` → 400.
**Commit:** `fix(api): accept sort, search and unread query params`

### 2.2 Web never sends the access token; refresh on 401 (F2)
**Why:** CLAUDE.md's stated design is "access token in memory, refresh token in HTTP-only cookie". Keep that design and make the client follow it.
**Do (apps/web/src/lib):**
- `api.ts`: remove the localStorage read. Add `configureAuth({ getAccessToken, refresh, onAuthFailure })`, called once from `auth-store.ts` after the store is created (this avoids a circular import).
- On a **401** from any path *except* `/auth/login`, `/auth/register` and `/auth/refresh`: run **one shared in-flight refresh** (a single promise reused by all concurrent callers), then retry the original request **once**. If the refresh fails, call `onAuthFailure()` (clear the store) and throw.
- Throw an `ApiError` with `status` and a readable `message` (Nest validation errors come back as `message: string[]`, so join them).
- Fix header merging: `...options` is spread *after* `headers` and can overwrite them. Merge headers explicitly.
- `auth/callback/page.tsx`: keep working with the in-memory token (it's updated in 3.5).
**Done when (manual + 5.2 tests):** register, log in, reload the page (still logged in via the cookie refresh), create a request, vote. All work with the API running locally.
**Commit:** `fix(web): send the in-memory access token and refresh it on 401`

### 2.3 Redis ranking index (F4, F5, F15)
**Design:** Redis is a **derived, rebuildable index**, never the source of truth.
**Do:**
- New `RequestRankingService` in `modules/requests/ranking/` that owns all ranking Redis access (callers stop calling `zadd` themselves):
  - `ensureGameIndex(gameId)`: if marker key `game:{id}:requests:indexed` is missing, load `id, voteCount, createdAt` for all of the game's requests and, in one `MULTI`, `DEL` the three sets, `ZADD` all members to top/new/hot, and `SET` the marker. Add the marker to `REDIS_KEYS` in `libs/shared`.
  - `upsert(request)`: called after create and after every vote change. It calls `ensureGameIndex` first (so the first write never creates a partial index), then `ZADD`s the three sets.
  - `page(gameId, sort, skip, take)` → `{ ids, total }`, using **`ZREVRANGE` for all three sorts** (new = newest first) and `ZCARD` for total.
  - On any Redis error, log it and fall back to the DB with the **same** semantics (`top`: voteCount desc, createdAt desc; `new`: createdAt desc; `hot`: voteCount desc, createdAt desc, documented as an approximation).
- Use `hot-score.ts` (1.3) everywhere; delete both private `calculateHotScore` copies, the unused `hoursSinceCreation`, and `HOT_SCORE_DECAY_HOURS` (or document what it would mean if kept).
**Tests (e2e):** create 3 requests **directly with Prisma** (no Redis), vote on one through the API, then list → all 3 returned and `total === 3`. `sort=new` returns newest first. `FLUSHDB` mid-test, then list → still correct (index rebuilt). Unit: ordering of `page()` per sort, using a real Redis.
**Commit:** `fix(api): make the Redis ranking index self-healing and fix newest-first order`

### 2.4 Map Prisma errors to HTTP codes (F6, partly)
**Do:** add `common/filters/prisma-exception.filter.ts` (`@Catch(Prisma.PrismaClientKnownRequestError)`): `P2002` → 409 (include the conflicting field names), `P2025` → 404, `P2003` → 404 "Related resource not found"; re-throw anything else so it stays a 500 and gets logged. Register it with `APP_FILTER` in `AppModule` so tests get it automatically.
**Tests:** unit tests for the mapping; e2e: registering the same username twice in parallel → one 201 and one 409, never 500.
**Commit:** `fix(api): map Prisma errors to 404 and 409 responses`

### 2.5 Idempotent, race-safe votes, likes, follows (F6)
**Why:** toggles can't be made correct under concurrency (two "unvote" clicks would re-vote). Idempotent `PUT`/`DELETE` say exactly what the client wants.
**Do:**
- New endpoints:
  - `PUT /requests/:id/vote` and `DELETE /requests/:id/vote` → `{ voted, voteCount }`.
  - `PUT /comments/:id/like` and `DELETE /comments/:id/like` → `{ liked, likeCount }`.
  - `PUT|DELETE /follows/users/:userId` and `PUT|DELETE /follows/games/:gameId` → `{ following }`.
- Pattern (votes shown; likes and follows are the same):
  - **PUT:** inside `prisma.$transaction(async tx => …)`: `tx.vote.create(…)` then `featureRequest.update({ voteCount: { increment: 1 } })`. Catch `P2002` **around** the `$transaction` call (a failed statement aborts a Postgres transaction, so it can't be caught inside) → already voted: no change, read and return the current count. Missing request (`P2003`) → 404 through the filter. Send the milestone notification only when the create succeeded and the new count equals a milestone.
  - **DELETE:** in a transaction, `tx.vote.deleteMany({ where: { userId, requestId } })`; if `count === 1`, decrement. If the request doesn't exist → 404.
  - After the transaction: `RequestRankingService.upsert(…)`.
- Keep the old `POST …/upvote`, `POST /comments/:id/like` and `POST /follows/...` toggles as thin wrappers marked `@ApiOperation({ deprecated: true })`, or remove them if nothing uses them after the web change. Note the choice in the Deviations log.
- Web: `request-card.tsx`, `requests/[id]/page.tsx`, `comment-section.tsx`, `games/[slug]/page.tsx` and `users/[username]/page.tsx` call PUT or DELETE based on current state, and disable the button while the request is in flight.
**Tests (e2e):** PUT twice → `voteCount` 1; DELETE twice → 0; **10 parallel PUTs** from one user → all 2xx and `voteCount` 1; 10 users voting in parallel → 10; vote on a missing ID → 404; DB `voteCount` always equals the number of Vote rows. The same set for likes and follows (plus self-follow → 400).
**Commit:** `fix(api,web): idempotent race-safe votes, likes and follows`

### 2.6 Consistent username validation (F12)
**Do:** move `USERNAME_REGEX`, min (3) and max (30) into `libs/shared/src/constants.ts`; use them in `RegisterDto` and `UpdateUserDto`. A duplicate username → 409 through the filter.
**Tests:** `PATCH /users/me` with `"a b"` → 400, `"ab"` → 400, a taken name → 409.
**Commit:** `fix(api): validate usernames the same way on register and update`

---

## Phase 3: Security hardening (test first)

### 3.1 Public profiles leak private fields (F7)
**Do:** in `users.service.ts`, define two explicit Prisma `select`s:
- `publicUserSelect` = `id, username, avatarUrl, userType, createdAt`
- `selfUserSelect` = public + `email, isAdmin`
Use public for `GET /users/:username` (plus counts) and self for `/auth/me` and `PATCH /users/me`. Grep for any other endpoint returning a full `user`/`author` object and narrow it.
**Tests:** `GET /users/:username` body has no `email`, `googleId`, `twitchId`, `isAdmin` or `passwordHash` keys.
**Commit:** `fix(security): stop exposing private user fields on public profiles`

### 3.2 Restrict WebSocket room subscriptions (F8)
**Do:** in `notifications.gateway.ts` `handleSubscribe`/`handleUnsubscribe`, accept only `typeof data?.room === 'string'` matching `/^request:[a-z0-9]{20,32}$/` (cuid). Otherwise return `{ error: 'Invalid room' }` and don't join. The private `user:<id>` room is joined only by the server at connect time.
**Tests (e2e with `socket.io-client`):** an authenticated client emitting `subscribe { room: 'user:<otherId>' }` is rejected and does **not** receive that user's notification; an unauthenticated connection is disconnected.
**Commit:** `fix(security): only allow subscribing to request rooms`

### 3.3 Turn rate limiting on (F9)
**Do:**
- `ThrottlerModule.forRootAsync` reading `THROTTLE_TTL_MS` (default 60000) and `THROTTLE_LIMIT` (default 100) from config; register `ThrottlerGuard` as `APP_GUARD`.
- `@Throttle({ default: { limit: AUTH_THROTTLE_LIMIT (default 10), ttl: 60000 } })` on `login`, `register` and `refresh`; `@SkipThrottle()` on health (6.1).
- Behind proxies, `req.ip` must be the client IP: in `configureApp`, `app.set('trust proxy', Number(config.TRUST_PROXY_HOPS ?? 0))`.
- Test env sets high limits; one e2e spec sets `AUTH_THROTTLE_LIMIT=3` before building its app and checks that the 4th bad login → **429**.
**Commit:** `fix(security): enable rate limiting with stricter auth limits`

### 3.4 Harden refresh tokens (F10)
**Do:**
- Add `jti: randomUUID()` to the refresh-token payload, so two tokens are never identical.
- Store **`tokenHash` = SHA-256(token)** instead of the raw token (migration: rename the column and keep it `@unique`; existing sessions are invalidated, which is fine). Look tokens up by hash.
- On login and register, delete that user's expired refresh tokens.
- Out of scope (note in README "Known limitations"): refresh-token *reuse detection*. It would log out every tab when two tabs refresh at once.
**Tests:** two logins for the same user in the same second → both 200; refresh rotates (the old cookie → 401, the new one → 200); the DB holds no raw token.
**Commit:** `fix(security): hash refresh tokens and make each token unique`

### 3.5 Harden OAuth (F11)
**Do:**
- Redirect to `${WEB_URL}/auth/callback#token=…` (a **fragment**, which browsers don't send to servers). The web callback reads `window.location.hash`, then calls `history.replaceState` to clear it.
- `validateOAuthUser`: match by provider ID first. Link to an existing account by email **only if the provider says the email is verified** (Google: `profile.emails[0].verified`; Twitch: skip email linking). If the email belongs to another account and can't be linked, redirect to `/login?error=account_exists` and show a message there.
- Guarantee a valid generated username (fit the regex from 2.6, pad to 3 chars, retry on collision).
**Tests:** unit-test `validateOAuthUser` with a mocked Prisma: verified email links; unverified doesn't link; no email collision creates a user.
**Commit:** `fix(security): keep OAuth tokens out of URLs and only link verified emails`

### 3.6 Timeouts on RAWG calls (F16)
**Do:** `fetch(url, { signal: AbortSignal.timeout(5000) })` in `rawg.adapter.ts`; a timeout → 504 `GatewayTimeoutException`. `POST /games/import/:externalId` gets `@Throttle` at 10 per hour per user. Import races are covered by the P2002 → 409 filter; return the existing game when it's already imported.
**Commit:** `fix(api): add timeouts and limits to RAWG game imports`

### 3.7 Safe, realistic seed (F13)
**Do (`libs/database/src/seed.ts`):**
- No hard-coded admin password. Create the admin only if `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set. With `NODE_ENV=production`, refuse to run if `SEED_ADMIN_PASSWORD` is shorter than 16 chars.
- Demo accounts: `demo_gamer` and `demo_dev` (the latter is DEVELOPER and assigned as dev for one game), password from `SEED_DEMO_PASSWORD` (default `try-the-demo`, which is intentionally public).
- Content: about 10 games (keep the sample list), about 25 requests over 4–5 games with mixed statuses and dev responses, comments with replies, and **real Vote rows** so every `voteCount` equals its vote rows (create ~15 extra seed users for voting).
- Idempotent (upserts on stable IDs); prints a summary. It no longer needs Redis (2.3 rebuilds the index).
**Done when:** `pnpm db:seed` run twice leaves the same row counts; the game page lists all seeded requests in all three sorts.
**Commit:** `feat(db): safe idempotent demo seed with consistent vote counts`

---

## Phase 4: Make the README's real-time claims true (F14)

### 4.1 Live notifications in the UI
**Do:**
- Open **one** socket per logged-in tab: move `useSocket` into a `SocketProvider` (React context) mounted inside `Providers`. It reconnects when the access token changes.
- Header bell: fetch `GET /me/notifications?unread=true&limit=1` on login to get `meta.unreadCount`; show a badge; on the socket `notification` event, increment it and show a small toast (no new dependency; a simple Tailwind toast is enough). The notifications page resets the count after "mark all read".
**Done when (manual):** with two browsers (demo_gamer and demo_dev), demo_dev changes the status of demo_gamer's request and demo_gamer's badge updates within about a second without reloading.
**Commit:** `feat(web): live notification badge and toasts over Socket.IO`

### 4.2 Live vote counts
**Do:** export `NotificationsGateway` from `NotificationsModule`; after each successful vote change, `VotesService` calls `gateway.sendVoteUpdate(requestId, voteCount)`. The request detail page subscribes to `request:<id>` (allowed by 3.2) and updates its count on `vote_update`; it unsubscribes on unmount.
**Tests (e2e):** a socket subscribed to `request:<id>` receives `vote_update` with the new count after another user's PUT.
**Commit:** `feat: broadcast live vote counts to request viewers`

---

## Phase 5: Coverage

### 5.1 Fill API coverage to target
**Target:** ≥ **80% lines** on `src/modules/**/*.service.ts`, `src/common/**` and `ranking/**`, enforced with `coverageThreshold` in `jest-e2e.json` (the e2e run is the coverage run). Don't chase controllers, DTOs or module files.
**Do:** add specs until the threshold passes. Must-have cases not already covered above:
- **Auth:** duplicate email → 409; wrong password → 401; logout clears the cookie, after which refresh → 401.
- **Games:** pagination `meta`; unknown slug → 404; import via the fake RAWG (new → 201; existing → same game).
- **Requests:** title < 5 chars → 400; status update: gamer → 403, developer of *another* game → 403, assigned dev → 200 and the author gets a `REQUEST_STATUS_CHANGE` notification; admin → 200; IN_PROGRESS notifies game followers.
- **Comments:** reply to a parent from another request → 404; depth limit (`MAX_COMMENT_DEPTH` = 5) → 403; threading shape of `GET …/comments`.
- **Notifications:** marking someone else's notification as read changes nothing; `read-all` only affects your own.
- **Admin:** non-admin → 403; grant → the user becomes DEVELOPER and the game is verified; revoke → back to GAMER when they have no other games.
- **Vote milestone:** 10 users vote → the author gets exactly one `VOTE_MILESTONE` notification.
**Commit:** `test(api): raise service coverage to 80% with e2e specs`

### 5.2 Web unit tests for the API client
**Do:** add Vitest (+ `jsdom`) to `apps/web` with a `test` script that runs in CI. Test `api.ts` with a mocked `fetch`: the bearer header is attached; **3 concurrent 401s trigger exactly one refresh** and then 3 retries; a failing refresh calls `onAuthFailure` once; `/auth/login` 401 never triggers a refresh; `ApiError.message` joins Nest validation arrays.
**Commit:** `test(web): cover token attach and single-flight refresh in the API client`

---

## Phase 6: Free live demo

**Target architecture**

```
Browser ──HTTPS──> Vercel (Next.js, Hobby)
   │                 └─ rewrite /api/v1/*  ──HTTPS──> Render free (NestJS API, Docker)
   └──────── Socket.IO (wss) directly ─────────────────┘   ├─ Neon Postgres (free)
                                                           └─ Render Key Value (free, in-memory)
```

Proxying REST through Vercel puts the API on the **same origin** as the site, so the `SameSite=Lax` refresh cookie keeps working (a cross-site `vercel.app` → `onrender.com` cookie would be blocked or dropped). The socket carries the access token in `auth`, so it doesn't need cookies.

### 6.1 API production readiness
**Do:**
- `GET /api/v1/health`: checks the DB (`SELECT 1`) and Redis (`PING`), returns `{ status, db, redis, uptime }` with 200, or 503 if one fails. `@SkipThrottle()`.
- `app.enableShutdownHooks()` in `main.ts`.
- `trust proxy` from 3.3. Set `TRUST_PROXY_HOPS` for the chain (browser → Vercel → Render), and verify the value in 6.7 by temporarily logging `req.ip` once.
- Prisma for Neon: add `directUrl = env("DIRECT_URL")` to the datasource (runtime uses Neon's **pooled** URL; migrations use the **direct** URL). Add `binaryTargets = ["native", "debian-openssl-3.0.x"]` to the generator. Add `DIRECT_URL` to every `.env.example`, the test env and CI (locally the same value as `DATABASE_URL`).
- Logging: replace `console.log` in `main.ts`, the gateway and `fcm.service.ts` with Nest `Logger`.
**Commit:** `feat(api): health endpoint, graceful shutdown and Neon-ready Prisma config`

### 6.2 Dockerfile for the API
**Do:** `apps/api/Dockerfile` (build context = repo root) plus a root `.dockerignore` (node_modules, .next, dist, .env*, coverage, .git).
- Multi-stage on `node:20-slim`: enable corepack pnpm → install with `--frozen-lockfile` → `pnpm db:generate` → build the libs and API (`turbo run build --filter=@game-review/api...`).
- Runtime: copy what's needed to run `node apps/api/dist/main.js` **and** `prisma migrate deploy` (simplest reliable approach: copy the built workspace with pruned production deps plus the `prisma` CLI). Correctness first, size second (aim for under ~700 MB).
- `CMD`: `sh -c "pnpm --filter @game-review/database exec prisma migrate deploy && node apps/api/dist/main.js"`. This is safe because the free tier runs a single instance.
- Run as the non-root `node` user; `EXPOSE 3001`; respect `PORT`.
**Done when:** `docker build -f apps/api/Dockerfile -t gamefeatures-api .` succeeds, and `docker run` against the compose Postgres and Redis serves `/api/v1/health` = 200 and `/docs`.
**Commit:** `build(api): add production Dockerfile`

### 6.3 Same-origin API through Next.js rewrites
**Do:**
- `next.config.js`: `rewrites()` → if `API_ORIGIN` is set, map `/api/v1/:path*` → `${API_ORIGIN}/api/v1/:path*`.
- `api.ts` default base URL becomes the relative `/api/v1`. `NEXT_PUBLIC_API_URL` stays as an optional override.
- `use-socket.ts`: read `NEXT_PUBLIC_SOCKET_URL` (default `http://localhost:3001`) instead of deriving it from the API URL.
- Local dev uses the rewrite too (`API_ORIGIN=http://localhost:3001` in `apps/web/.env.example`), so dev and prod behave the same.
- API: `WEB_URL` may be a comma-separated list; split it for both `enableCors` and the gateway CORS (the gateway reads `process.env` at import, so on Render it must be a real environment variable, which it is).
**Done when:** locally, after logging in, a hard reload keeps you logged in (the cookie refresh goes through the rewrite).
**Commit:** `feat(web): proxy the API through Next.js rewrites for same-origin cookies`

### 6.4 Demo-mode UX
**Do (`NEXT_PUBLIC_DEMO_MODE=true`):**
- **Cold-start banner:** on first load, call `/api/v1/health` with an 8 s timeout. If it takes more than 2 s, show "Waking up the free demo server, this can take up to a minute…" and keep retrying every 5 s until it answers, then hide the banner.
- **Login page:** "Try as gamer" and "Try as developer" buttons that log in as `demo_gamer` or `demo_dev` (`NEXT_PUBLIC_DEMO_PASSWORD`).
- Hide the Google and Twitch buttons unless `NEXT_PUBLIC_OAUTH_PROVIDERS` lists them.
- Footer note: "Demo data may be reset. Please don't post personal information."
- Fix the `<title>` / header branding to say **GameFeatures** consistently (the code currently says "Game Review" and "GameReview").
**Commit:** `feat(web): demo mode with cold-start banner and one-click demo logins`

### 6.5 Render blueprint and deploy runbook
**Do:**
- `render.yaml`: one **web service** (`runtime: docker`, `plan: free`, `dockerfilePath: ./apps/api/Dockerfile`, `dockerContext: .`, `healthCheckPath: /api/v1/health`) and one **Key Value** (`plan: free`, `ipAllowList: []` for internal-only). Env vars: `REDIS_URL` via `fromService` (the Key Value connection string); `JWT_SECRET` and `JWT_REFRESH_SECRET` via `generateValue: true`; `NODE_ENV=production`, `TRUST_PROXY_HOPS`, `THROTTLE_*`; and `DATABASE_URL`, `DIRECT_URL`, `WEB_URL`, `API_URL` as `sync: false` (entered in the dashboard). Check the field names against Render's current Blueprint spec.
- `docs/DEPLOY.md`: the runbook for 6.7, plus a **pre-deploy checklist** (CI green on the commit; migrations tested on a fresh DB; env vars set on both platforms; seed variables set), a **rollback plan** (Render: "Rollback" to the previous deploy; Vercel: "Instant Rollback"; DB migrations are forward-only, so ship schema changes expand-then-contract), and **rollback triggers** (health 503 for more than 5 minutes after wake, login or voting failing in the smoke test, 5xx on the main flows).
- Note: if the free web service can't reach the Key Value internal URL, switch `REDIS_URL` to an Upstash free database. BullMQ's background polling uses part of Upstash's free command quota, so watch the usage.
**Commit:** `docs(deploy): add Render blueprint and deploy runbook`

### 6.6 Smoke-test script
**Do:** `scripts/smoke-test.sh <WEB_URL>` (bash + curl + jq, with a cookie jar):
1. Wait until health is 200 (up to 90 s).
2. `GET /api/v1/games?limit=5` → 200.
3. `GET /api/v1/games/<slug>/requests?sort=new` → 200, `data.length > 0`.
4. Log in as `demo_gamer` → token.
5. `GET /auth/me` → `demo_gamer`.
6. `PUT` then `DELETE` a vote → counts go +1 then −1.
7. `POST /auth/refresh` with the cookie jar → 200.
8. Log out.

Exit non-zero on any failure, with a clear message. Add `pnpm smoke <url>`.
**Commit:** `test: add production smoke-test script`

### 6.7 🧑 MANUAL: create accounts, deploy, seed, smoke-test
Claude Code prepares and checks; **the user** does the account and secret steps. Follow `docs/DEPLOY.md`:
1. **Neon:** create a project in a region close to the Render region. Copy the **pooled** URL (→ `DATABASE_URL`) and the **direct** URL (→ `DIRECT_URL`).
2. **Render:** New → Blueprint → this repo/branch. Fill in the `sync: false` vars. The first deploy runs the migrations.
3. **Seed once** from your machine: `DATABASE_URL=<direct> DIRECT_URL=<direct> SEED_DEMO_PASSWORD=… pnpm db:seed` (admin optional).
4. **Vercel:** import the repo, Root Directory `apps/web`, framework Next.js. Env: `API_ORIGIN=https://<render-app>.onrender.com`, `NEXT_PUBLIC_SOCKET_URL=https://<render-app>.onrender.com` (sockets connect directly to Render), `NEXT_PUBLIC_DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_PASSWORD=…`. If the monorepo install fails, set the install command to `pnpm install --frozen-lockfile` at the repo root.
5. Set Render's `WEB_URL` (and `API_URL`) to the Vercel URL and redeploy.
6. Run `pnpm smoke https://<vercel-app>.vercel.app`. Then by hand: two browsers, a live notification and a live vote count.
7. Record the URLs in the README (7.1).
**Done when:** the smoke test passes against production and the manual checks pass.

---

## Phase 7: Documentation

### 7.1 README, CLAUDE.md, LICENSE
**Do:**
- README: name **GameFeatures**; CI badge; **Live demo** link with the cold-start note and demo logins; a short "what it is" + screenshots/GIF (🧑 the user records them; leave clearly marked placeholders); an architecture diagram (Mermaid); an **Engineering highlights** section (self-healing Redis ranking index, idempotent race-safe votes, refresh rotation with hashed tokens, room-scoped sockets, e2e tests against real Postgres/Redis, CI); a Testing section (commands, coverage target); the updated env var table (`DIRECT_URL`, `API_ORIGIN`, `NEXT_PUBLIC_*`, `THROTTLE_*`, `TRUST_PROXY_HOPS`, `SEED_*`); clone path `cd gamefeatures`; **remove** the admin credentials table and replace it with the demo logins; Known limitations (single-instance sockets, no reuse detection, free-tier cold starts, OAuth and push off in the demo).
- CLAUDE.md: new commands (`typecheck`, `test:e2e`, `smoke`, migrations workflow), the testing conventions, and "Redis is a derived index" as a design rule.
- Add `LICENSE` (MIT, "Copyright (c) 2026 Ali Konain").
**Commit:** `docs: update README, CLAUDE.md and add MIT license`

---

## Out of scope (don't do these)

- Major upgrades (Next 15, NestJS 11, Prisma 6+), or replacing BullMQ, Socket.IO or zustand.
- Turning on OAuth or FCM in the demo, or a mobile client.
- Multi-instance scaling (the Socket.IO Redis adapter, distributed `userSockets`).
- Refresh-token reuse detection; email verification; password reset.
- New product features beyond what's listed here.

## Definition of done

- CI is green on `improvement-plan`: lint, typecheck, build, unit, e2e (≥ 80% service line coverage) and web tests.
- Every finding F1–F17 is fixed (or explicitly deferred in the Deviations log with a reason) and each 🔴/🟠 has a regression test.
- The live demo passes `pnpm smoke` and the manual two-browser real-time check.
- The README shows the live demo, CI badge, architecture and honest limitations.

---

## Deviations log

_Add an entry whenever reality differs from this plan: date, step, what changed, why._

- **2026-11-24, 0.1: no build errors to fix.** With the Prisma client generated, `libs/*` and `apps/api` compiled cleanly (no implicit-`any` errors), so this step's commit only adds the env example below and ticks the box. The web build fails only on F3 (`/auth/callback`, `/games`), as expected.
- **2026-11-24, 0.1: Postgres/Redis ran natively, not via Docker.** The session's workspace got `429 Too Many Requests` from Docker Hub on anonymous pulls, so Postgres 16 and Redis 7 ran as local processes on the same ports and credentials as `docker-compose.yml`. Nothing in the repo depends on this. CI (1.5) uses service containers as planned.
- **2026-11-24, 0.1: added `libs/database/.env.example`.** The Prisma CLI in `libs/database` reads `libs/database/.env` (already git-ignored), not the root `.env`, so `db:push` failed with "Environment variable not found: DATABASE_URL" until it was created. The example documents it; the README setup `cp` was added in 0.3, which touched those setup docs anyway.
- **2026-11-24, 0.1: local Node was 22, not 20.** The workspace has Node 22; everything built and ran. CI pins Node 20 (1.5).
- **2026-11-24, 0.1: F1 and F2 confirmed** (by sending the web app's exact requests to the dev API, since the dev server wasn't reachable from a browser in this workspace):
  - F1: `GET /games/:slug/requests?sort=hot&page=1&limit=10` → 400 "property sort should not exist"; `GET /games?search=portal&limit=8` → 400 "property search should not exist"; `GET /me/notifications?unread=true` → 400 "property unread should not exist". Without the extra key the same requests → 200.
  - F2: after register, `GET /auth/me` without a header (what the web sends) → 401, with `Authorization: Bearer <token>` → 200. `apps/web/src/lib/api.ts:14` reads `localStorage['auth-storage']`, and nothing in `apps/web/src` writes it.
- **2026-11-24, 1.3: both `calculateHotScore` copies now call `hot-score.ts`.** They were byte-for-byte the same formula, so pointing them at the extracted function was a pure refactor and avoids a third copy until 2.3. 2.3 still owns the dead `HOT_SCORE_DECAY_HOURS` constant (its unused import and the unused `hoursSinceCreation` were removed in 1.1 to make lint pass).
- **2026-11-24, 1.4: `RedisModule` now quits its client on shutdown.** The shared ioredis client was never closed, which would keep Jest (and a stopping container) alive. It implements `OnApplicationShutdown`, so `app.close()` releases it; BullMQ and Prisma already close themselves. This is the "close all Redis/BullMQ connections" item, done in the app rather than in each test.
- **2026-11-24, 1.4: harness details.** `test/.env.test` is loaded by a `setupFiles` script (before `AppModule` is imported) and by `globalSetup`, without overriding variables already set, so CI can override them. `prisma migrate deploy` creates `game_review_test` when it's missing. `reset.ts` and `globalSetup` refuse to run unless the database name ends in `_test`. The e2e transform only matches `.ts`, so ts-jest doesn't try to compile the libs' built `.js`. `apps/api/tsconfig.json` now includes `test/**/*`, so typecheck and lint cover the tests.
- **2026-11-24, 1.4: pnpm 8 passes `--` through to Jest literally.** `pnpm --filter @game-review/api test:e2e -- --coverage` makes Jest treat `--coverage` as a test-path pattern and find no tests. Pass Jest flags without the `--` (`... test:e2e --coverage`); 1.5's CI step does that.
- **2026-11-24, after 1.4: restored `apps/api/dist/main.js`.** Adding `test/**/*` to `apps/api/tsconfig.json` (1.4) made `nest build` (plain `tsc`) emit to `dist/src/main.js`, which would break `pnpm start` and the 6.2 Dockerfile. CI didn't catch it because nothing ran the built server. Fixed the NestJS-standard way with `apps/api/tsconfig.build.json` (excludes `test/` and `*.spec.ts`; the Nest CLI uses it automatically), and CI now fails if `dist/main.js` is missing. Committed separately as `fix(build): …` because it repairs an earlier step.
- **2026-11-24, 2.2: how it was verified, plus two additions.** Verified by driving the built web app in headless Chrome against the built API (script kept outside the repo): register → `/auth/me` 200 with bearer; reload → `/auth/refresh` 200 → `/auth/me` 200; create request 201; vote 201; then the API was restarted with a different `JWT_SECRET` (refresh secret unchanged), and the next vote went 401 → one `/auth/refresh` 200 → retry 201; login after clearing cookies works. Unit tests for the client follow in 5.2 as planned (`ApiClient` takes an injectable `fetch` for that). Additions: (1) `initialize()` uses the client's shared `refreshAccessToken()` instead of its own `/auth/refresh` call, because refresh tokens rotate and a page-load refresh racing a 401-triggered refresh would log the user out; (2) if the token changed while a request was in flight, the 401 retry reuses the new token instead of refreshing again. Also added `api.put()` for 2.5.
- **2026-11-24, 2.3: the "indexed" marker has a 1-hour TTL (`RANKING_INDEX_TTL_SECONDS`).** The plan's MULTI (DEL + ZADD + SET marker) leaves one narrow race: a rebuild that read the table just before another request committed can run its MULTI after that request's ZADD and drop it. Rather than add locking, the marker expires after an hour, so any such drift (or a failed upsert while Redis was flaky) heals on the next read. `upsert()` also deletes the marker if its own Redis write fails. The Redis-error fallback lives inside `RequestRankingService.page()`, so `RequestsService` has no Redis code at all. `HOT_SCORE_DECAY_HOURS` was removed from `libs/shared` (nothing used it; the hot formula's time term is documented in `hot-score.ts`).
- **2026-11-24, 2.5: the old POST toggles were removed, not kept as deprecated wrappers.** After the web change nothing calls `POST /requests/:id/upvote`, `POST /comments/:id/like` or `POST /follows/...`, and a toggle can't be made correct under concurrency, so keeping it would keep the bug reachable. The 2.3 ranking specs now vote with `PUT`. Verified in headless Chrome against the built apps: vote/unvote on a card (PUT 200 → count 1, DELETE 200 → 0), follow/unfollow a game, comment then like/unlike (count 1 → 0); buttons are disabled while their request is in flight.
- **2026-11-24, 2.5: test app now listens on a random port.** Ten parallel supertest calls against a non-listening server each opened their own listener and intermittently failed with `ECONNRESET`. `createTestApp()` calls `app.listen(0, '127.0.0.1')` (which also suits the socket tests in 3.2/4.2); three consecutive full runs were clean.
- **2026-11-24, 2.5: Prisma no longer logs errors itself outside development.** It printed every handled duplicate (P2002) as `prisma:error`, which in production would log an error on every double-click. Unhandled Prisma errors still reach Nest's logger through `PrismaExceptionFilter`. Development keeps query/error/warn logging.
- **2026-11-24, 3.1: where the selects live and who uses them.** `publicUserSelect`/`selfUserSelect` are in `modules/users/user.selects.ts`. `/auth/me` now calls `UsersService.findSelf()` (self select) instead of `AuthService.validateUser()`, which was removed (it had no other caller). The grep for other full-user responses found none: request/comment/follow responses already select `{ id, username, avatarUrl }`, the admin endpoints that include `email` are behind `AdminGuard`, and `comments.service` loads the full request author only to address a notification.
- **2026-11-24, 3.3: implementation notes.** The auth limit is a per-request resolvable (`AUTH_THROTTLE` in `common/throttle.ts`, reading `AUTH_THROTTLE_LIMIT`/`AUTH_THROTTLE_TTL_MS`) so it stays configurable without a custom guard; invalid or empty values fall back to the defaults. `trust proxy` is set in `configureApp()` from `TRUST_PROXY_HOPS` (default 0), and a test proves a spoofed `X-Forwarded-For` can't reset the limit. `resetState()` now also clears the throttler's in-memory counters so specs don't depend on order. New variables are in both `.env.example` files.
- **2026-11-24, 3.3: web client keeps the session on a throttled refresh.** `/auth/refresh` is now rate-limited, and the 2.2 client treated any failed refresh as a lost session. Now only a 401/403 from `/auth/refresh` calls `onAuthFailure()`; a 429, 5xx or network error just fails that request and the refresh cookie stays usable. Note for 6.7: if `TRUST_PROXY_HOPS` is wrong in production, every visitor would share the proxy's IP and its limits, so it must be verified as the plan says.
- **2026-11-24, 3.4: migration written by hand, plus an atomic refresh claim.** `prisma migrate dev` refuses non-interactive shells when a change drops data, so `20261124034500_hash_refresh_tokens` was generated with `prisma migrate diff` and starts with `DELETE FROM "RefreshToken"` (old plaintext tokens can't be hashed retroactively; everyone signs in once). The redundant `@@index([token])` went with the column (the unique index covers lookups). Beyond the plan, `refreshTokens()` claims the old token with one `deleteMany` (hash + user + not expired) instead of find-then-delete, so two parallel refreshes with the same cookie give exactly one 200 and one 401 (tested). Expired-token cleanup runs in `generateTokens()`, i.e. on login, register, refresh and OAuth sign-in. README has a new "Known limitations" section (7.1 expands it).
- **2026-11-24, 3.5: OAuth result type and extra cases.** `validateOAuthUser()` takes `{ provider, providerId, email?, emailVerified, username, avatarUrl? }` and returns `{ tokens }` or `{ error: 'account_exists' | 'email_required' }`; the callback controller redirects errors to `/login?error=<code>` (no cookie set) and successes to `/auth/callback#token=…`. Beyond the plan: an email already linked to a *different* Google ID is also `account_exists`; a provider with no email returns `email_required` (the schema needs one); an email taken by a parallel sign-up between the check and the insert is `account_exists`. The callback page no longer uses `useSearchParams` (so no Suspense wrapper) and navigates with `router.replace`. Unit tests use a mocked Prisma as planned (12 cases). Since there are no OAuth credentials, the web half was checked in headless Chrome: `/auth/callback#token=<real access token>` signs in, the fragment is cleared, the token never appears in any request URL, a missing token goes to `/login`, and `/login?error=account_exists` shows the message.
- **2026-11-24, 3.6: per-user import limit and race handling.** The global ThrottlerGuard runs before `JwtAuthGuard`, so `req.user` isn't set yet; the import route's `@Throttle` uses a route-level `getTracker` (`userOrIpTracker` in `common/throttle.ts`) that decodes the bearer token's `sub` without verifying it. That's safe for counting because `JwtAuthGuard` rejects forged tokens right after and only valid tokens can import; no token falls back to the IP. A parallel import of the same game catches P2002 and returns the row the other request created (instead of a 409); other unique clashes (e.g. slug) stay 409. The timeout is `RAWG_TIMEOUT_MS` (default 5000, documented in `.env.example`) so the unit test can use 50 ms. The three adapter methods share one `getJson()`.
- **2026-11-24, 3.7: seed changes beyond the plan.** (1) The seed no longer fetches from RAWG when `RAWG_API_KEY` is set: demo data should be deterministic and its requests reference the sample games; RAWG import stays available in the app. (2) It deletes the two legacy seed accounts (`admin@gamereview.com` / `user@example.com`), whose passwords were published in the README, so re-seeding an old database closes that hole. (3) Counters are recomputed for *all* requests and comments from their rows (not only seeded ones), so real users' votes are kept and stay consistent. (4) Seed voters (`seed_voter_01..15`) have no password and can't log in. (5) A `seed.e2e-spec.ts` runs the real script against the test DB (idempotence, consistent counts, no default admin, demo logins, admin only with env, production refusal, all requests listed in all sorts), so CI keeps the seed working. The README's credentials table was replaced by the demo logins now rather than in 7.1, since it would otherwise document accounts that no longer exist. Done-when checked on the dev DB: two runs → identical counts, 0 admins, 0 requests whose voteCount differs from its Vote rows.
- **2026-11-24, 4.1: implementation notes.** The unread count and toasts live in a small zustand store (`lib/stores/notification-store.ts`) so the header badge and the notifications page share one number (marking read there updates the badge at once). `SocketProvider` remembers subscribed rooms and re-joins them after every reconnect (a token refresh reconnects the socket), which 4.2 relies on. `hooks/use-socket.ts` now just re-exports `useSocket` from the provider. An e2e spec covers the server half (the author's socket receives the notification after a developer's status change; a bystander's doesn't; the unread count matches). Manual check in headless Chrome against the built apps and the seeded DB: demo_gamer signed in, demo_dev changed seed-req-02's status via the API, the badge went 0 → 1 in ~70 ms without a reload, the toast showed the notification, and "Mark all read" cleared the badge. There's no status-change UI for developers in the web app, so demo_dev acted through the API.
- **2026-11-24, during 4.2: socket room names accept any safe request ID.** The 3.2 rule only allowed cuid-shaped IDs (`request:[a-z0-9]{20,32}`), but the 3.7 seed uses readable IDs (`seed-req-10`), so live vote counts silently didn't work on seeded requests (found by the 4.2 browser check; the server rejected the subscribe). The rule is now `request:[A-Za-z0-9_-]{1,64}`: the `request:` prefix plus a charset without `:` is what keeps clients out of `user:<id>` rooms. New tests cover a seeded ID, `request:abc:user:xyz` (rejected) and an overlong ID (rejected). Committed separately as `fix(api): …`.
- **2026-11-24, 4.2: broadcast only real changes.** `VotesService` calls `sendVoteUpdate` only when a vote row was actually created or deleted, so idempotent no-op PUT/DELETEs don't broadcast (tested). Anonymous visitors don't get live counts (the socket requires a signed-in user), which is acceptable for the demo. Verified with two headless Chrome sessions on a seeded request: demo_dev watching, demo_gamer voting → demo_dev's count changed 5 → 6 in ~60 ms and back to 5 on unvote, without a reload.
- **2026-11-24, after 4.2: per-user flags survive a page reload.** Found during the 4.2 check (not in the review): pages fetched their data before the session was restored from the refresh cookie, so after a full reload `hasVoted` / `isFollowing` / `hasLiked` came back as an anonymous visitor's (e.g. a voted request showed as not voted, and clicking sent a no-op PUT). The request page, game page, request list, user profile, comment section and trending page now include the signed-in user's ID in their fetch effects, so they refetch once the session is restored (and on login/logout). Verified before/after in headless Chrome: the request page showed "voted" after a reload only with the fix. Committed separately as `fix(web): …`. It has no automated test: 5.2 covers the API client, and component tests (React Testing Library) are out of this plan's scope.
- **2026-11-24, 5.1: the coverage run includes the unit specs.** `jest-e2e.json` now matches `src/**/*.spec.ts` as well as `test/**/*.e2e-spec.ts`, so code covered by unit tests (OAuth linking, the Prisma error mapping, the RAWG timeout, FCM) counts toward the threshold. The unit specs are fast and need nothing extra; `pnpm test` still runs them on their own. `collectCoverageFrom` is the plan's scope (services, `common/**`, `ranking/**`) and `coverageThreshold.global.lines` is 80, enforced in CI via `test:e2e --coverage`. New specs: auth, games, requests (status-change permission matrix, follower notifications, the 10-vote milestone), comments (threading, cross-request parent 404, depth limit 403), notifications (others' notifications untouched, read-all scope, device tokens), admin (grant/revoke/list/make-admin), profiles/feed/follow lists, plus an FCM unit spec with `firebase-admin` mocked. Result: 95.6% lines (from 63.4%), 167 tests in the coverage run; all the must-have cases passed first time, so no new bugs.
- **2026-11-24, 5.2: Vitest 4 + jsdom 28, chosen for Node 20.** The newest majors (Vitest 5, jsdom 29+) require Node 22, but CI and the plan stay on Node 20, so the web app uses Vitest 4.1 and jsdom 28 (both support Node 20.19+). `pnpm test` (turbo) now runs the web tests next to the API unit tests, so CI's existing "Unit tests" step covers them. 15 tests on `ApiClient` (injected `fetch`): the plan's five cases plus header merging (a caller can't override `Authorization`), the 429-refresh-keeps-the-session rule from 3.3, the "token changed while in flight" retry, retry-only-once, 204 handling, and the non-JSON error fallback.
- **2026-11-25, 6.1: health details, production `TRUST_PROXY_HOPS`, and a stricter test-DB guard.** `GET /api/v1/health` lives in `modules/health/` (so its service counts toward coverage). Each check has a 3 s deadline, because ioredis queues commands while Redis is unreachable and would otherwise hang the check; a failure logs the reason and returns only `down` (no connection details in the body). The 503 body is the same report. Tests: 200 shape, 503 for DB down and for Redis down, no error text leaked, and 5 health calls under a global limit of 2 never 429 (while `/games` does). **Production `TRUST_PROXY_HOPS` = 2**: the REST chain is browser → Vercel (rewrite) → Render's proxy → API, so `X-Forwarded-For` reaches the app as `client, vercel` and Express must skip two hops to get the client. 6.5 puts it in `render.yaml`; 6.7 still verifies it by logging `req.ip` once. Caveat for the runbook: someone calling the `onrender.com` URL directly can forge the first `X-Forwarded-For` entry and so dodge the per-IP limits (a shared-secret header from Vercel would close this; out of scope for the demo). `assertTestDatabase()` now checks `DIRECT_URL` as well as `DATABASE_URL`, since `prisma migrate deploy` in `globalSetup` now connects through `DIRECT_URL`. `main.ts` logs the port and `/docs` path rather than `http://localhost:…`, which is wrong in production.
- **2026-11-25, 6.2: `prisma` moved to production dependencies; CMD calls the CLI directly; CI boots the image.** (1) `prisma migrate deploy` runs in the container, so the `prisma` CLI is now a `dependency` (not a devDependency) of `@game-review/database`; the lockfile change is only that move. (2) The CMD runs `libs/database/node_modules/.bin/prisma migrate deploy` and then `exec node apps/api/dist/main.js` instead of `pnpm --filter … exec` + `node`: no corepack download of pnpm at boot (the `node` user has no cached pnpm), and `exec` makes node PID 1 so it receives Render's SIGTERM directly (under a plain `sh -c` the signal would go to the shell and the graceful shutdown from 6.1 wouldn't run). Verified: `docker stop` exits with code 0 at once. (3) The prod-deps stage installs with `--filter "@game-review/api..."` and deliberately leaves `apps/web/package.json` out: with it present, pnpm also installed the web app's dependencies (Next.js and its SWC binaries), and the image was 1.21 GB; without it, 613 MB. (4) Docker worked in this session, so Postgres and Redis ran with `docker compose` as planned. The workspace's egress proxy re-signs TLS, so the build was run locally with `--build-arg NODE_IMAGE=<a node:20-slim that trusts that CA>` (built outside the repo); the committed Dockerfile defaults to plain `node:20-slim`. Because of that, CI has a new `docker` job that builds the image on GitHub's runners and boots it against service containers (migrate an empty DB, `/health` 200, `/docs` 200), so the real Dockerfile is proven on a clean machine. Local verification: empty DB migrated (2 migrations), `/health` 200, `/docs` 200, register 201, runs as `node`.
- **2026-11-25, 6.3: implementation notes.** `WEB_URL` parsing is one helper, `common/web-origins.ts` (`webOrigins()` trims spaces and trailing slashes and defaults to `http://localhost:3000`; `primaryWebUrl()` is the first entry), used by `enableCors`, the gateway's decorator CORS and the OAuth redirect. Tests first: unit tests for the parser and for the OAuth redirect target (a new `auth.controller.spec.ts` calls the callback handlers with a fake response), and `cors.e2e-spec.ts` (both listed origins get `Access-Control-Allow-Origin` with credentials, an unlisted one gets none). The socket URL now lives in `socket-provider.tsx` (`hooks/use-socket.ts` only re-exports it). The login page's OAuth links reuse the exported `API_URL` from `lib/api.ts`, so they go through the rewrite too. **Two production notes for 6.5/6.7:** (1) `rewrites()` are compiled into the build, so `API_ORIGIN` must be set on Vercel *before* building; (2) if OAuth is ever turned on, the server's `API_URL` (used for the provider callback URL) must be the *web* URL, so the callback and its refresh cookie go through the rewrite and land on the web origin. Verified in headless Chrome against the built apps with `API_ORIGIN=http://localhost:3001`: every REST call went to `localhost:3000/api/v1/...`; the `refreshToken` cookie is host-only for the web origin (`SameSite=Lax`, `httpOnly`); after a hard reload `/auth/refresh` → 200 and `/auth/me` → 200; the socket connected directly to the API.
- **2026-11-25, 6.4: implementation notes.** The wake-up logic is a pure function, `lib/wake-server.ts` (`waitForServer`), unit-tested with fake timers (fast answer → no banner; banner after 2 s; 8 s per attempt and a retry every 5 s; a failed answer such as a 502 from the proxy shows the banner at once; stops on unmount). `components/demo-banner.tsx` uses it with `GET /api/v1/health`. **Beyond the plan:** once the server answers after the banner was shown, the page reloads once, because the page's own requests and the session restore most likely failed while the server slept (a reload finds it awake, so it can't loop). Demo settings are in `lib/demo.ts`. **OAuth buttons:** `NEXT_PUBLIC_OAUTH_PROVIDERS` decides when set; when unset they're hidden in demo mode and shown otherwise, so local setups keep their current behaviour (tested). The demo buttons share the form's `signIn()`, so errors and the `?error=` OAuth messages still show. The footer note renders only in demo mode. Branding: page title, header and the Swagger title now say GameFeatures. New variables are in `apps/web/.env.example`. Verified in headless Chrome against a demo-mode production build: with the API stopped the banner appeared after ~0.2 s (the proxy fails fast), and after starting the API it went away within ~7 s with one reload; the login page showed both demo buttons and no Google/Twitch; "Try as developer" signed in as `demo_dev` (DEVELOPER); `/login?error=account_exists` still shows its message. The web lint warnings are the pre-existing `<img>` and hook-deps warnings (six in total across five files, not two as the handoff notes said; none are from this step).
- **2026-11-25, 6.5: Blueprint details, an opt-in client-IP log, and Neon URL advice.** `render.yaml` was checked against Render's current spec and validated against its published JSON Schema (`render.com/schema/render.yaml.json`, with Ajv; a deliberately broken file fails it). Choices: `autoDeployTrigger: checksPass` (the current field; `autoDeploy` is deprecated), so Render deploys only commits whose CI passed; Key Value `maxmemoryPolicy: noeviction`, because BullMQ needs it (an LRU policy could evict queued jobs); `region: frankfurt` for both services (can't be changed after creation; the runbook pairs it with Neon's Frankfurt region and says how to change both); `TRUST_PROXY_HOPS: '2'` (6.1). Render's `preDeployCommand` isn't available on free services, which confirms migrating in the container's CMD (6.2). **Beyond the plan:** instead of a temporary code change to log `req.ip` in 6.7 (two deploys), `configureApp()` logs the resolved client IP and raw `X-Forwarded-For` when `LOG_CLIENT_IP=true`; the runbook turns it on, checks it, and turns it off. `client-ip.e2e-spec.ts` covers it and pins down the hops math: with 2 hops, `X-Forwarded-For: client, vercel` from the proxy resolves to the client, a client-prepended entry is ignored, and nothing is logged by default. `docs/DEPLOY.md` also says to add `connect_timeout=15` to both Neon URLs (computes scale to zero) and **not** to add `pgbouncer=true` (Neon's pooler supports prepared statements; Prisma recommends leaving it off for PgBouncer 1.21+), that `API_ORIGIN` needs a Vercel redeploy to change, and the direct-`onrender.com` rate-limit caveat from 6.1.
- **2026-11-25, 6.6: the smoke test restores the vote, checks logout, and runs in CI.** `scripts/smoke-test.sh <url>` (`pnpm smoke <url>`) follows the plan's 8 steps with three additions: health must also report `db` and `redis` up; the vote step reads `hasVoted` first and runs PUT→DELETE or DELETE→PUT, so it checks both directions and always leaves the demo data as it found it (the seed can make `demo_gamer` a voter); and after logout it checks that the old refresh cookie now gets 401. A 429 on login/refresh says to wait a minute. Account, username, game slug and wake timeout can be overridden by `SMOKE_*` variables. Verified locally against the web app's rewrite (both vote orders) and against the production Docker image (`NODE_ENV=production`, so a `Secure` cookie over `http://localhost`, which curl keeps); failure cases checked: no URL → usage and exit 2; wrong password → "login: expected HTTP 200, got 401" with the body; API down → "health never returned 200"; API started 12 s after the script → it waited and passed. **Beyond the plan:** CI's `docker` job now seeds the image's database and runs `pnpm smoke http://localhost:3001` against the container (the API serves `/api/v1` itself), so the script can't rot before 6.7.
- **2026-11-26, 6.7 (in progress): Vercel build fixes found before the Vercel step.** The API is live on Render (`https://gamefeatures-api.onrender.com`; health OK, migrations applied, seeded from the user's Mac; `pnpm smoke` against it passed all 8 steps). Preparing the Vercel step turned up two problems that would have broken the web deploy: (1) with Root Directory `apps/web`, Vercel would run a plain `next build`, but the web app imports `@game-review/shared`, whose `main` is the git-ignored `dist/`, so the build would fail; (2) Turborepo 2 runs tasks in strict env mode, so `API_ORIGIN` (not a `NEXT_PUBLIC_*` variable) never reached `next build`: reproduced locally, the build succeeded with `rewrites: []`, i.e. every API call from the deployed site would 404. Locally it had worked only because Next.js reads `.env.local` itself. Test first: `scripts/check-web-rewrite.mjs <origin>` reads the built `routes-manifest.json` and fails without the expected rewrite; it failed on the broken build. Fix: the `build` task in `turbo.json` declares `env: ["API_ORIGIN", "NEXT_PUBLIC_*"]` (which also makes them part of the cache key), and `apps/web/vercel.json` sets the build command to `cd ../.. && pnpm exec turbo run build --filter=@game-review/web`, so the shared lib builds first. CI's build step now sets `API_ORIGIN` and runs the check. `docs/DEPLOY.md` step 4 updated.
- **2026-11-26, 6.7 done: the demo is live.** Web: https://gamefeatures.vercel.app (Vercel; production branch switched to `improvement-plan`, deployed from it). API: https://gamefeatures-api.onrender.com (Render Blueprint, Frankfurt; Neon Postgres in `eu-central-1`, pooled `DATABASE_URL` + direct `DIRECT_URL`, both with `connect_timeout=15`; Neon's `channel_binding=require` kept, since Prisma 5's engines honour it, as checked locally; Render Key Value reachable, so no Upstash). The user created the accounts, entered the secrets and seeded from their Mac (fresh clone; `prisma migrate deploy` then `pnpm db:seed` with the direct URL). Neon's own "set up with an agent" instructions (Neon CLI, `neon.ts`, driver choice) were not used: the app only needs the two URLs. Checks: `pnpm smoke` passed all 8 steps against both the Render URL and the Vercel URL; CORS preflight from the Vercel origin is allowed; headless Chrome against production: the `refreshToken` cookie is host-only on `gamefeatures.vercel.app` (`Secure`, `HttpOnly`, `SameSite=Lax`), a hard reload keeps the session (`/auth/me` 200 through the rewrite), the socket connects to `wss://gamefeatures-api.onrender.com`; **live vote**: `demo_gamer` voted on `seed-req-04` and `demo_dev`'s open page went 6 → 7 without a reload (undone afterwards); **live notification**: `demo_dev` set `demo_gamer`'s `seed-req-02` to `IN_PROGRESS` and `demo_gamer`'s bell showed "1 unread" after 270 ms (status restored to `UNDER_REVIEW`, dev response unchanged; the two notifications were marked read and stay in `demo_gamer`'s history, since notifications can't be deleted). **`TRUST_PROXY_HOPS=2` verified**: with `LOG_CLIENT_IP=true`, the user found their own public IP as `ip=` in Render's logs, then removed the variable.
- **2026-11-26, 7.1: README checked against the code.** The old README's endpoint list was wrong in places (e.g. `POST /requests/:id/upvote`, `POST /follows/...` toggles, which no longer exist), so the new **API overview** was rebuilt from the live Swagger spec (43 routes) and links to Swagger instead of listing everything. Every highlight was checked against the code before writing (ranking marker in the same `MULTI` and 1-hour TTL, concurrent-vote tests, atomic refresh claim, room pattern, test counts: 145 e2e + 39 unit in the coverage run, ~96% lines). The env table covers all variables from the `.env.example` files (adds `AUTH_THROTTLE_TTL_MS`, `RAWG_TIMEOUT_MS`, `SEED_ADMIN_USERNAME`). The Mermaid diagram was rendered with mermaid-cli to check it. Screenshots are a marked placeholder (🧑 the user records them). The project-structure tree no longer lists a `docker/` folder (it never existed). CLAUDE.md also gained the deployment notes (Dockerfile, `render.yaml`, `vercel.json`, the `turbo.json` env rule) and the conventions from the handoff notes. `LICENSE` is the standard MIT text.
