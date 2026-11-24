import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createRequest, createUser, TestUser } from './utils/factories';
import { resetState } from './utils/reset';

describe('Profiles, feed and follow lists (e2e)', () => {
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

  const auth = (u: TestUser) => ['Authorization', `Bearer ${u.token}`] as const;
  const follow = (me: TestUser, them: TestUser) =>
    t.http().put(`/api/v1/follows/users/${them.user.id}`).set(...auth(me)).expect(200);

  it("lists a user's requests, newest first, with counts", async () => {
    const author = await createUser(t, { username: 'prolific' });
    const game = await createGame(t);
    await createRequest(t, author, game.id, { title: 'First request' });
    await createRequest(t, author, game.id, { title: 'Second request' });

    const res = await t.http().get('/api/v1/users/prolific/requests').expect(200);

    expect(res.body.data.map((r: { title: string }) => r.title)).toEqual(['Second request', 'First request']);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0]).toMatchObject({ commentsCount: 0, author: { username: 'prolific' } });
  });

  it('unknown usernames are 404', async () => {
    await t.http().get('/api/v1/users/nobody_here').expect(404);
    await t.http().get('/api/v1/users/nobody_here/requests').expect(404);
  });

  it('profile counts followers, following and requests', async () => {
    const [star, fan1, fan2] = [await createUser(t, { username: 'star' }), await createUser(t), await createUser(t)];
    await follow(fan1, star);
    await follow(fan2, star);
    await follow(star, fan1);

    const res = await t.http().get('/api/v1/users/star').expect(200);
    expect(res.body).toMatchObject({ followersCount: 2, followingCount: 1, requestsCount: 0 });
  });

  it("the feed shows requests by people you follow, and is empty when you follow nobody", async () => {
    const [me, followed, stranger] = [await createUser(t), await createUser(t), await createUser(t)];
    const game = await createGame(t);
    await createRequest(t, followed, game.id, { title: 'From someone I follow' });
    await createRequest(t, stranger, game.id, { title: 'From a stranger' });

    const empty = await t.http().get('/api/v1/users/me/feed').set(...auth(me)).expect(200);
    expect(empty.body).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });

    await follow(me, followed);
    const feed = await t.http().get('/api/v1/users/me/feed').set(...auth(me)).expect(200);
    expect(feed.body.data.map((r: { title: string }) => r.title)).toEqual(['From someone I follow']);
  });

  it('lists followers, following and followed games with public fields only', async () => {
    const [me, them] = [await createUser(t), await createUser(t)];
    const game = await createGame(t);
    await follow(me, them);
    await t.http().put(`/api/v1/follows/games/${game.id}`).set(...auth(me)).expect(200);

    const followers = await t.http().get(`/api/v1/follows/users/${them.user.id}/followers`).expect(200);
    expect(followers.body.data).toEqual([{ id: me.user.id, username: me.user.username, avatarUrl: null }]);
    expect(followers.body.meta.total).toBe(1);

    const following = await t.http().get(`/api/v1/follows/users/${me.user.id}/following`).expect(200);
    expect(following.body.data).toEqual([{ id: them.user.id, username: them.user.username, avatarUrl: null }]);

    const games = await t.http().get('/api/v1/follows/me/games').set(...auth(me)).expect(200);
    expect(games.body.data.map((g: { id: string }) => g.id)).toEqual([game.id]);
  });
});
