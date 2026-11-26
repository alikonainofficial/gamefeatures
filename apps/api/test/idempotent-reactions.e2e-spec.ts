import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createRequest, createUser, TestUser } from './utils/factories';
import { resetState } from './utils/reset';

// F6: toggles did read-then-write, so concurrent clicks hit unique constraints (500) and two
// "unvote" clicks re-voted. PUT/DELETE say exactly what the client wants and are idempotent.
describe('Idempotent votes, likes and follows (e2e)', () => {
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

  const MISSING_ID = 'cmissingidmissingidmissin';
  const auth = (u: TestUser) => ['Authorization', `Bearer ${u.token}`] as const;
  const users = async (n: number) => {
    const list: TestUser[] = [];
    for (let i = 0; i < n; i++) list.push(await createUser(t));
    return list;
  };

  describe('votes: PUT/DELETE /requests/:id/vote', () => {
    let author: TestUser;
    let requestId: string;

    beforeEach(async () => {
      author = await createUser(t);
      const game = await createGame(t);
      requestId = (await createRequest(t, author, game.id)).id;
    });

    const put = (u: TestUser, id = requestId) => t.http().put(`/api/v1/requests/${id}/vote`).set(...auth(u));
    const del = (u: TestUser, id = requestId) => t.http().delete(`/api/v1/requests/${id}/vote`).set(...auth(u));

    async function expectCountsConsistent(expected: number) {
      const request = await t.prisma.featureRequest.findUniqueOrThrow({ where: { id: requestId } });
      const rows = await t.prisma.vote.count({ where: { requestId } });
      expect({ voteCount: request.voteCount, rows }).toEqual({ voteCount: expected, rows: expected });
    }

    it('PUT twice leaves one vote; DELETE twice leaves none', async () => {
      const [voter] = await users(1);

      expect((await put(voter).expect(200)).body).toEqual({ voted: true, voteCount: 1 });
      expect((await put(voter).expect(200)).body).toEqual({ voted: true, voteCount: 1 });
      await expectCountsConsistent(1);

      expect((await del(voter).expect(200)).body).toEqual({ voted: false, voteCount: 0 });
      expect((await del(voter).expect(200)).body).toEqual({ voted: false, voteCount: 0 });
      await expectCountsConsistent(0);
    });

    it('10 parallel PUTs from one user all succeed and count once', async () => {
      const [voter] = await users(1);
      const results = await Promise.all(Array.from({ length: 10 }, () => put(voter)));

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      await expectCountsConsistent(1);
    });

    it('10 parallel DELETEs from one user all succeed and remove once', async () => {
      const [voter, other] = await users(2);
      await put(voter).expect(200);
      await put(other).expect(200);

      const results = await Promise.all(Array.from({ length: 10 }, () => del(voter)));

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      await expectCountsConsistent(1);
    });

    it('10 users voting in parallel count 10', async () => {
      const voters = await users(10);
      const results = await Promise.all(voters.map((v) => put(v)));

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      await expectCountsConsistent(10);
    });

    it('voting on a missing request is 404 (PUT and DELETE)', async () => {
      const [voter] = await users(1);
      await put(voter, MISSING_ID).expect(404);
      await del(voter, MISSING_ID).expect(404);
    });

    it('requires authentication', async () => {
      await t.http().put(`/api/v1/requests/${requestId}/vote`).expect(401);
    });
  });

  describe('likes: PUT/DELETE /comments/:id/like', () => {
    let commentId: string;

    beforeEach(async () => {
      const author = await createUser(t);
      const game = await createGame(t);
      const request = await createRequest(t, author, game.id);
      const res = await t
        .http()
        .post(`/api/v1/requests/${request.id}/comments`)
        .set(...auth(author))
        .send({ content: 'A comment to like' })
        .expect(201);
      commentId = res.body.id;
    });

    const put = (u: TestUser, id = commentId) => t.http().put(`/api/v1/comments/${id}/like`).set(...auth(u));
    const del = (u: TestUser, id = commentId) => t.http().delete(`/api/v1/comments/${id}/like`).set(...auth(u));

    async function expectCountsConsistent(expected: number) {
      const comment = await t.prisma.comment.findUniqueOrThrow({ where: { id: commentId } });
      const rows = await t.prisma.commentLike.count({ where: { commentId } });
      expect({ likeCount: comment.likeCount, rows }).toEqual({ likeCount: expected, rows: expected });
    }

    it('PUT twice leaves one like; DELETE twice leaves none', async () => {
      const [liker] = await users(1);

      expect((await put(liker).expect(200)).body).toEqual({ liked: true, likeCount: 1 });
      expect((await put(liker).expect(200)).body).toEqual({ liked: true, likeCount: 1 });
      expect((await del(liker).expect(200)).body).toEqual({ liked: false, likeCount: 0 });
      expect((await del(liker).expect(200)).body).toEqual({ liked: false, likeCount: 0 });
      await expectCountsConsistent(0);
    });

    it('10 parallel PUTs from one user count once', async () => {
      const [liker] = await users(1);
      const results = await Promise.all(Array.from({ length: 10 }, () => put(liker)));

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      await expectCountsConsistent(1);
    });

    it('10 users liking in parallel count 10', async () => {
      const likers = await users(10);
      const results = await Promise.all(likers.map((l) => put(l)));

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      await expectCountsConsistent(10);
    });

    it('liking a missing comment is 404 (PUT and DELETE)', async () => {
      const [liker] = await users(1);
      await put(liker, MISSING_ID).expect(404);
      await del(liker, MISSING_ID).expect(404);
    });
  });

  describe('follows: PUT/DELETE /follows/users/:id and /follows/games/:id', () => {
    it('following a user is idempotent both ways', async () => {
      const [me, them] = await users(2);
      const put = () => t.http().put(`/api/v1/follows/users/${them.user.id}`).set(...auth(me));
      const del = () => t.http().delete(`/api/v1/follows/users/${them.user.id}`).set(...auth(me));

      expect((await put().expect(200)).body).toEqual({ following: true });
      expect((await put().expect(200)).body).toEqual({ following: true });
      expect(await t.prisma.follow.count({ where: { followerId: me.user.id } })).toBe(1);

      expect((await del().expect(200)).body).toEqual({ following: false });
      expect((await del().expect(200)).body).toEqual({ following: false });
      expect(await t.prisma.follow.count({ where: { followerId: me.user.id } })).toBe(0);
    });

    it('10 parallel user follows from one user create one row', async () => {
      const [me, them] = await users(2);
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          t.http().put(`/api/v1/follows/users/${them.user.id}`).set(...auth(me)),
        ),
      );

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect(await t.prisma.follow.count({ where: { followerId: me.user.id } })).toBe(1);
    });

    it('following a game is idempotent and race-safe', async () => {
      const [me] = await users(1);
      const game = await createGame(t);
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          t.http().put(`/api/v1/follows/games/${game.id}`).set(...auth(me)),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect(await t.prisma.follow.count({ where: { gameId: game.id } })).toBe(1);

      await t.http().delete(`/api/v1/follows/games/${game.id}`).set(...auth(me)).expect(200);
      await t.http().delete(`/api/v1/follows/games/${game.id}`).set(...auth(me)).expect(200);
      expect(await t.prisma.follow.count({ where: { gameId: game.id } })).toBe(0);
    });

    it('cannot follow yourself (400)', async () => {
      const [me] = await users(1);
      await t.http().put(`/api/v1/follows/users/${me.user.id}`).set(...auth(me)).expect(400);
    });

    it('following a missing user or game is 404', async () => {
      const [me] = await users(1);
      await t.http().put(`/api/v1/follows/users/${MISSING_ID}`).set(...auth(me)).expect(404);
      await t.http().delete(`/api/v1/follows/users/${MISSING_ID}`).set(...auth(me)).expect(404);
      await t.http().put(`/api/v1/follows/games/${MISSING_ID}`).set(...auth(me)).expect(404);
      await t.http().delete(`/api/v1/follows/games/${MISSING_ID}`).set(...auth(me)).expect(404);
    });
  });
});
