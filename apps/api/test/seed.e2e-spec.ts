import { execSync } from 'child_process';
import { join } from 'path';
import { createTestApp, TestApp } from './utils/create-test-app';
import { resetState } from './utils/reset';

const REPO_ROOT = join(__dirname, '..', '..', '..');

/** Runs the real seed script (libs/database) against the test database. */
function runSeed(env: Record<string, string | undefined> = {}) {
  return execSync('pnpm --filter @game-review/database seed', {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'development', ...env },
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

// F13: the seed created an admin with a published password (admin123), and its voteCounts
// (42, 128) didn't match the Vote rows.
describe('Seed script (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function rowCounts() {
    const p = t.prisma;
    return {
      users: await p.user.count(),
      games: await p.game.count(),
      requests: await p.featureRequest.count(),
      votes: await p.vote.count(),
      comments: await p.comment.count(),
      likes: await p.commentLike.count(),
    };
  }

  it('is idempotent, creates demo data with consistent counts, and no default admin', async () => {
    runSeed({ SEED_ADMIN_EMAIL: undefined, SEED_ADMIN_PASSWORD: undefined });
    const first = await rowCounts();
    runSeed({ SEED_ADMIN_EMAIL: undefined, SEED_ADMIN_PASSWORD: undefined });
    expect(await rowCounts()).toEqual(first);

    expect(first.games).toBeGreaterThanOrEqual(10);
    expect(first.requests).toBeGreaterThanOrEqual(20);
    expect(first.comments).toBeGreaterThan(0);

    // No admin without SEED_ADMIN_*; the old published accounts are gone.
    expect(await t.prisma.user.count({ where: { isAdmin: true } })).toBe(0);
    expect(await t.prisma.user.findUnique({ where: { email: 'admin@gamereview.com' } })).toBeNull();

    // Every denormalized count matches its rows.
    for (const r of await t.prisma.featureRequest.findMany({ include: { _count: { select: { votes: true } } } })) {
      expect({ id: r.id, voteCount: r.voteCount }).toEqual({ id: r.id, voteCount: r._count.votes });
    }
    for (const c of await t.prisma.comment.findMany({ include: { _count: { select: { likes: true } } } })) {
      expect({ id: c.id, likeCount: c.likeCount }).toEqual({ id: c.id, likeCount: c._count.likes });
    }

    // Mixed statuses, developer responses and threaded replies.
    const statuses = new Set((await t.prisma.featureRequest.findMany()).map((r) => r.status));
    expect(statuses.size).toBeGreaterThanOrEqual(4);
    expect(await t.prisma.featureRequest.count({ where: { devResponse: { not: null } } })).toBeGreaterThan(0);
    expect(await t.prisma.comment.count({ where: { parentId: { not: null } } })).toBeGreaterThan(0);
  });

  it('demo accounts log in with SEED_DEMO_PASSWORD, and demo_dev manages a game', async () => {
    runSeed({ SEED_DEMO_PASSWORD: 'custom-demo-pass' });

    for (const email of ['demo_gamer@demo.gamefeatures.dev', 'demo_dev@demo.gamefeatures.dev']) {
      await t
        .http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'custom-demo-pass' })
        .expect(200);
    }
    const dev = await t.prisma.user.findUniqueOrThrow({ where: { username: 'demo_dev' } });
    expect(dev.userType).toBe('DEVELOPER');
    expect(await t.prisma.game.count({ where: { devUserId: dev.id } })).toBe(1);
  });

  it('creates an admin only when SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set', async () => {
    runSeed({ SEED_ADMIN_EMAIL: 'owner@example.com', SEED_ADMIN_PASSWORD: 'a-long-admin-password-123' });

    const admin = await t.prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(admin.isAdmin).toBe(true);
    await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'a-long-admin-password-123' })
      .expect(200);
  });

  it('refuses a short admin password in production', async () => {
    expect(() =>
      runSeed({
        NODE_ENV: 'production',
        SEED_ADMIN_EMAIL: 'owner@example.com',
        SEED_ADMIN_PASSWORD: 'short',
      }),
    ).toThrow(/at least 16 characters/);
    expect(await t.prisma.user.count()).toBe(0);
  });

  it('every seeded request is listed for its game in all three sorts', async () => {
    runSeed();

    for (const game of await t.prisma.game.findMany({ include: { _count: { select: { featureRequests: true } } } })) {
      for (const sort of ['hot', 'top', 'new']) {
        const res = await t
          .http()
          .get(`/api/v1/games/${game.slug}/requests?sort=${sort}&limit=100`)
          .expect(200);
        expect({ game: game.slug, sort, total: res.body.meta.total, listed: res.body.data.length }).toEqual({
          game: game.slug,
          sort,
          total: game._count.featureRequests,
          listed: game._count.featureRequests,
        });
      }
    }
  });
});
