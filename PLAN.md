# GameFeatures: Improvement Plan

**Goal:** turn GameFeatures from a single-commit prototype into a project that builds, has tests, runs CI on every push, and has a free public demo, fixing the bugs and security holes found in the November 2026 review along the way.

**Branch:** `improvement-plan` (this file lives there). Make every commit on this branch; never push to `main`.

---

## How to use this plan (instructions for the Claude Code session)

1. Work through the steps **in order**. Each step lists *Why*, *Do*, *Done when* and a *Commit* message.
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
- [ ] 2.6 Consistent username validation on profile update
- [ ] 3.1 Stop leaking email, OAuth IDs and isAdmin on public profiles
- [ ] 3.2 Restrict WebSocket room subscriptions
- [ ] 3.3 Turn rate limiting on
- [ ] 3.4 Harden refresh tokens
- [ ] 3.5 Harden OAuth (token in URL, unverified-email account linking)
- [ ] 3.6 Timeouts on outbound RAWG calls
- [ ] 3.7 Safe, realistic seed data
- [ ] 4.1 Live notifications in the UI
- [ ] 4.2 Live vote counts
- [ ] 5.1 Fill API coverage to target
- [ ] 5.2 Web unit tests for the API client
- [ ] 6.1 API production readiness (health, proxy, shutdown, Neon)
- [ ] 6.2 Dockerfile for the API
- [ ] 6.3 Same-origin API through Next.js rewrites
- [ ] 6.4 Demo-mode UX (cold-start banner, demo logins, OAuth hidden)
- [ ] 6.5 Render blueprint and deploy runbook
- [ ] 6.6 Smoke-test script
- [ ] 6.7 🧑 MANUAL: create accounts, deploy, seed, smoke-test
- [ ] 7.1 README, CLAUDE.md and LICENSE

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
