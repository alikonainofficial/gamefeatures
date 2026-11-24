import { RequestType } from '@game-review/database';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createUser, TestUser } from './utils/factories';
import { resetState } from './utils/reset';

// F4/F5: once any Redis member existed, the sorted sets were the list source even when they
// held only some of a game's requests, and "new" read oldest-first from Redis.
describe('Request lists backed by the Redis ranking index (e2e)', () => {
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

  /** Inserts requests straight into Postgres, bypassing the API (and so Redis), like the seed. */
  async function insertRequests(author: TestUser, gameId: string) {
    const base = Date.parse('2026-11-01T00:00:00Z');
    const make = (title: string, hoursAfter: number) =>
      t.prisma.featureRequest.create({
        data: {
          gameId,
          authorId: author.user.id,
          type: RequestType.ADD_FEATURE,
          title,
          description: 'Inserted directly with Prisma.',
          createdAt: new Date(base + hoursAfter * 3_600_000),
        },
      });
    return {
      oldest: await make('oldest', 0),
      middle: await make('middle', 1),
      newest: await make('newest', 2),
    };
  }

  const list = async (slug: string, sort: string, token?: string) => {
    const req = t.http().get(`/api/v1/games/${slug}/requests?sort=${sort}&page=1&limit=10`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req.expect(200);
    return {
      titles: res.body.data.map((r: { title: string }) => r.title) as string[],
      total: res.body.meta.total as number,
    };
  };

  it('lists every request after the first vote, with the right total, in all sorts', async () => {
    const author = await createUser(t);
    const voter = await createUser(t);
    const game = await createGame(t);
    const { middle } = await insertRequests(author, game.id);

    await t
      .http()
      .put(`/api/v1/requests/${middle.id}/vote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);

    for (const sort of ['hot', 'top', 'new']) {
      const { titles, total } = await list(game.slug, sort);
      expect({ sort, total, titles: [...titles].sort() }).toEqual({
        sort,
        total: 3,
        titles: ['middle', 'newest', 'oldest'],
      });
    }
  });

  it('sort=new returns newest first', async () => {
    const author = await createUser(t);
    const game = await createGame(t);
    await insertRequests(author, game.id);

    expect((await list(game.slug, 'new')).titles).toEqual(['newest', 'middle', 'oldest']);
  });

  it('sort=top puts the most-voted request first', async () => {
    const author = await createUser(t);
    const voters = [await createUser(t), await createUser(t)];
    const game = await createGame(t);
    const { oldest, middle } = await insertRequests(author, game.id);

    for (const voter of voters) {
      await t
        .http()
        .put(`/api/v1/requests/${oldest.id}/vote`)
        .set('Authorization', `Bearer ${voter.token}`)
        .expect(200);
    }
    await t
      .http()
      .put(`/api/v1/requests/${middle.id}/vote`)
      .set('Authorization', `Bearer ${voters[0].token}`)
      .expect(200);

    expect((await list(game.slug, 'top')).titles).toEqual(['oldest', 'middle', 'newest']);
  });

  it('rebuilds the index after Redis is flushed mid-test', async () => {
    const author = await createUser(t);
    const voter = await createUser(t);
    const game = await createGame(t);
    const { newest } = await insertRequests(author, game.id);

    await list(game.slug, 'hot'); // builds the index
    await t.redis.flushdb(); // e.g. a Redis restart on the free tier

    await t
      .http()
      .put(`/api/v1/requests/${newest.id}/vote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);

    const { titles, total } = await list(game.slug, 'new');
    expect(total).toBe(3);
    expect(titles).toEqual(['newest', 'middle', 'oldest']);
  });

  it('includes a request created through the API alongside pre-existing ones', async () => {
    const author = await createUser(t);
    const game = await createGame(t);
    await insertRequests(author, game.id);

    await t
      .http()
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${author.token}`)
      .send({
        gameId: game.id,
        type: RequestType.ADD_FEATURE,
        title: 'created via api',
        description: 'Created through the HTTP endpoint.',
      })
      .expect(201);

    const { titles, total } = await list(game.slug, 'new');
    expect(total).toBe(4);
    expect(titles[0]).toBe('created via api');
  });
});
