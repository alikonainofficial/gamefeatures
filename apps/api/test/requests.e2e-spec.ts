import { RequestType, UserType } from '@game-review/database';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createRequest, createUser, notificationsOf, TestUser } from './utils/factories';
import { resetState } from './utils/reset';
import { waitFor } from './utils/wait-for';

describe('Feature requests (e2e)', () => {
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
  const setStatus = (u: TestUser, requestId: string, status: string, devResponse?: string) =>
    t
      .http()
      .patch(`/api/v1/requests/${requestId}/status`)
      .set(...auth(u))
      .send({ status, devResponse });

  describe('create and read', () => {
    it('rejects a title under 5 characters and a short description (400)', async () => {
      const me = await createUser(t);
      const game = await createGame(t);
      const post = (title: string, description: string) =>
        t
          .http()
          .post('/api/v1/requests')
          .set(...auth(me))
          .send({ gameId: game.id, type: RequestType.ADD_FEATURE, title, description });

      await post('abcd', 'A description that is long enough.').expect(400);
      await post('Long enough title', 'too short').expect(400);
    });

    it('creating for a missing game is 404', async () => {
      const me = await createUser(t);
      await t
        .http()
        .post('/api/v1/requests')
        .set(...auth(me))
        .send({
          gameId: 'cmissingidmissingidmissin',
          type: RequestType.ADD_FEATURE,
          title: 'Valid title',
          description: 'A description that is long enough.',
        })
        .expect(404);
    });

    it('GET /requests/:id returns the request with hasVoted for the viewer', async () => {
      const author = await createUser(t);
      const viewer = await createUser(t);
      const game = await createGame(t);
      const request = await createRequest(t, author, game.id);
      await t.http().put(`/api/v1/requests/${request.id}/vote`).set(...auth(viewer)).expect(200);

      const anonymous = await t.http().get(`/api/v1/requests/${request.id}`).expect(200);
      expect(anonymous.body).toMatchObject({ id: request.id, voteCount: 1, hasVoted: false, commentsCount: 0 });

      const asViewer = await t.http().get(`/api/v1/requests/${request.id}`).set(...auth(viewer)).expect(200);
      expect(asViewer.body.hasVoted).toBe(true);
    });

    it('an unknown request is 404', async () => {
      await t.http().get('/api/v1/requests/cmissingidmissingidmissin').expect(404);
    });

    it('notifies the followers of the author about a new request', async () => {
      const author = await createUser(t);
      const fan = await createUser(t);
      const game = await createGame(t);
      await t.http().put(`/api/v1/follows/users/${author.user.id}`).set(...auth(fan)).expect(200);

      await createRequest(t, author, game.id, { title: 'Followers should hear about this' });

      const notes = await waitFor(async () => {
        const n = await notificationsOf(t, fan.user.id, 'FOLLOWED_USER_POST');
        expect(n).toHaveLength(1);
        return n;
      });
      expect(notes[0].message).toContain('Followers should hear about this');
    });
  });

  describe('status updates', () => {
    let author: TestUser;
    let dev: TestUser;
    let requestId: string;
    let gameId: string;

    beforeEach(async () => {
      author = await createUser(t);
      dev = await createUser(t, { userType: UserType.DEVELOPER });
      const game = await createGame(t, { devUserId: dev.user.id });
      gameId = game.id;
      requestId = (await createRequest(t, author, game.id)).id;
    });

    it('a gamer cannot change the status (403)', async () => {
      const gamer = await createUser(t);
      await setStatus(gamer, requestId, 'UNDER_REVIEW').expect(403);
    });

    it("the developer of another game cannot change it (403)", async () => {
      const otherDev = await createUser(t, { userType: UserType.DEVELOPER });
      await createGame(t, { devUserId: otherDev.user.id });
      await setStatus(otherDev, requestId, 'UNDER_REVIEW').expect(403);
    });

    it("the game's developer can, and the author is notified", async () => {
      const res = await setStatus(dev, requestId, 'UNDER_REVIEW', 'Looking at it').expect(200);
      expect(res.body).toMatchObject({ status: 'UNDER_REVIEW', devResponse: 'Looking at it' });
      expect(res.body.devRespondedAt).toEqual(expect.any(String));

      await waitFor(async () =>
        expect(await notificationsOf(t, author.user.id, 'REQUEST_STATUS_CHANGE')).toHaveLength(1),
      );
    });

    it('an admin can change any request', async () => {
      const admin = await createUser(t, { isAdmin: true });
      await setStatus(admin, requestId, 'DECLINED').expect(200);
    });

    it('setting the same status again sends no new notification', async () => {
      await setStatus(dev, requestId, 'UNDER_REVIEW').expect(200);
      await waitFor(async () =>
        expect(await notificationsOf(t, author.user.id)).toHaveLength(1),
      );
      await setStatus(dev, requestId, 'UNDER_REVIEW', 'Still looking').expect(200);
      await new Promise((r) => setTimeout(r, 300));
      expect(await notificationsOf(t, author.user.id)).toHaveLength(1);
    });

    it('IN_PROGRESS and IMPLEMENTED notify the game followers', async () => {
      const follower = await createUser(t);
      await t.http().put(`/api/v1/follows/games/${gameId}`).set(...auth(follower)).expect(200);

      await setStatus(dev, requestId, 'IN_PROGRESS').expect(200);
      await setStatus(dev, requestId, 'IMPLEMENTED').expect(200);

      const notes = await waitFor(async () => {
        const n = await notificationsOf(t, follower.user.id, 'FOLLOWED_GAME_UPDATE');
        expect(n).toHaveLength(2);
        return n;
      });
      expect(notes.map((n) => n.message).join(' ')).toMatch(/started working on/);
    });

    it('an invalid status is 400; an unknown request is 404', async () => {
      await setStatus(dev, requestId, 'SHIPPED').expect(400);
      await setStatus(dev, 'cmissingidmissingidmissin', 'OPEN').expect(404);
    });
  });

  it('10 users voting gives the author exactly one VOTE_MILESTONE notification', async () => {
    const author = await createUser(t);
    const game = await createGame(t);
    const request = await createRequest(t, author, game.id);
    const voters: TestUser[] = [];
    for (let i = 0; i < 11; i++) voters.push(await createUser(t));

    for (const voter of voters.slice(0, 10)) {
      await t.http().put(`/api/v1/requests/${request.id}/vote`).set(...auth(voter)).expect(200);
    }
    // An 11th vote passes the milestone without hitting another one.
    await t.http().put(`/api/v1/requests/${request.id}/vote`).set(...auth(voters[10])).expect(200);

    await waitFor(async () =>
      expect(await notificationsOf(t, author.user.id, 'VOTE_MILESTONE')).toHaveLength(1),
    );
    await new Promise((r) => setTimeout(r, 300));
    const milestones = await notificationsOf(t, author.user.id, 'VOTE_MILESTONE');
    expect(milestones).toHaveLength(1);
    expect(milestones[0].message).toContain('10 votes');
  });
});
