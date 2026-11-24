import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createUser } from './utils/factories';
import { resetState } from './utils/reset';

describe('Games (e2e)', () => {
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

  it('paginates the game list with correct meta', async () => {
    for (let i = 0; i < 5; i++) await createGame(t);

    const res = await t.http().get('/api/v1/games?page=2&limit=2').expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ total: 5, page: 2, limit: 2, totalPages: 3 });
  });

  it('rejects invalid pagination (400)', async () => {
    await t.http().get('/api/v1/games?page=0').expect(400);
    await t.http().get('/api/v1/games?limit=101').expect(400);
  });

  it('GET /games/:slug returns counts, and isFollowing for the signed-in user', async () => {
    const me = await createUser(t);
    const game = await createGame(t);
    await t
      .http()
      .put(`/api/v1/follows/games/${game.id}`)
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200);

    const anonymous = await t.http().get(`/api/v1/games/${game.slug}`).expect(200);
    expect(anonymous.body).toMatchObject({ slug: game.slug, followersCount: 1, requestsCount: 0, isFollowing: false });

    const signedIn = await t
      .http()
      .get(`/api/v1/games/${game.slug}`)
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200);
    expect(signedIn.body.isFollowing).toBe(true);
  });

  it('an unknown slug is 404', async () => {
    await t.http().get('/api/v1/games/no-such-game').expect(404);
  });

  it('searches RAWG (through the fake adapter) and maps the results', async () => {
    t.rawg.add({ id: 77, name: 'Hollow Knight', released: '2017-02-24', genres: [{ id: 1, name: 'Metroidvania', slug: 'm' }] });
    t.rawg.add({ id: 78, name: 'Celeste' });

    const res = await t.http().get('/api/v1/games/search/rawg?query=hollow').expect(200);

    expect(res.body.meta).toMatchObject({ total: 1, page: 1 });
    expect(res.body.data[0]).toMatchObject({ name: 'Hollow Knight' });
  });

  it('RAWG search requires a query (400)', async () => {
    await t.http().get('/api/v1/games/search/rawg').expect(400);
  });
});
