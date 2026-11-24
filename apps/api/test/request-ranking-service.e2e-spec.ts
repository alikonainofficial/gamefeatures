import { RequestType } from '@game-review/database';
import { REDIS_KEYS } from '@game-review/shared';
import {
  RANKING_INDEX_TTL_SECONDS,
  RequestRankingService,
} from '../src/modules/requests/ranking/request-ranking.service';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createUser } from './utils/factories';
import { resetState } from './utils/reset';

describe('RequestRankingService against real Redis', () => {
  let t: TestApp;
  let ranking: RequestRankingService;

  beforeAll(async () => {
    t = await createTestApp();
    ranking = t.app.get(RequestRankingService);
  });

  beforeEach(async () => {
    await resetState(t);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await t.app.close();
  });

  /**
   * a: oldest, 10 votes. b: 12h later, 1 vote. c: 13h later, 0 votes.
   * top = a, b, c. new = c, b, a. hot: 10 votes are worth 1 point and so are 12.5 hours, so
   * a = 1.00, b = 0 + 12/12.5 = 0.96, c = 0 + 13/12.5 = 1.04 (relative to a's age) -> c, a, b.
   */
  async function seed() {
    const author = await createUser(t);
    const game = await createGame(t);
    const t0 = Date.parse('2026-11-01T00:00:00Z');
    const make = (title: string, voteCount: number, hours: number) =>
      t.prisma.featureRequest.create({
        data: {
          gameId: game.id,
          authorId: author.user.id,
          type: RequestType.ADD_FEATURE,
          title,
          description: 'ranking fixture',
          voteCount,
          createdAt: new Date(t0 + hours * 3_600_000),
        },
      });
    const a = await make('a', 10, 0);
    const b = await make('b', 1, 12);
    const c = await make('c', 0, 13);
    return { game, a, b, c };
  }

  it('orders each sort from the index and reports the full total', async () => {
    const { game, a, b, c } = await seed();

    expect(await ranking.page(game.id, 'top', 0, 10)).toEqual({ ids: [a.id, b.id, c.id], total: 3 });
    expect(await ranking.page(game.id, 'new', 0, 10)).toEqual({ ids: [c.id, b.id, a.id], total: 3 });
    expect(await ranking.page(game.id, 'hot', 0, 10)).toEqual({ ids: [c.id, a.id, b.id], total: 3 });
  });

  it('pages with skip/take', async () => {
    const { game, b, a } = await seed();
    expect(await ranking.page(game.id, 'new', 1, 2)).toEqual({ ids: [b.id, a.id], total: 3 });
  });

  it('builds the index once, with a TTL, and serves it from Redis', async () => {
    const { game } = await seed();
    await ranking.page(game.id, 'top', 0, 10);

    const marker = REDIS_KEYS.gameRequestsIndexed(game.id);
    const ttl = await t.redis.ttl(marker);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(RANKING_INDEX_TTL_SECONDS);
    expect(await t.redis.zcard(REDIS_KEYS.gameRequestsHot(game.id))).toBe(3);

    const findMany = jest.spyOn(t.prisma.featureRequest, 'findMany');
    await ranking.page(game.id, 'hot', 0, 10);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('upsert on a cold index rebuilds first instead of creating a partial index', async () => {
    const { game, b } = await seed();

    await ranking.upsert({ ...b, voteCount: 50 });

    expect(await t.redis.zcard(REDIS_KEYS.gameRequestsTop(game.id))).toBe(3);
    expect((await ranking.page(game.id, 'top', 0, 1)).ids).toEqual([b.id]);
  });

  it('falls back to Postgres with the same ordering when Redis fails', async () => {
    const { game, a, b, c } = await seed();
    jest.spyOn(t.redis, 'exists').mockRejectedValue(new Error('connection lost'));

    expect(await ranking.page(game.id, 'top', 0, 10)).toEqual({ ids: [a.id, b.id, c.id], total: 3 });
    expect(await ranking.page(game.id, 'new', 0, 10)).toEqual({ ids: [c.id, b.id, a.id], total: 3 });
  });

  it('upsert swallows Redis errors so the write that triggered it still succeeds', async () => {
    const { b } = await seed();
    jest.spyOn(t.redis, 'exists').mockRejectedValue(new Error('connection lost'));

    await expect(ranking.upsert(b)).resolves.toBeUndefined();
  });
});
