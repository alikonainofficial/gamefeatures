import { MAX_COMMENT_DEPTH } from '@game-review/shared';
import { createTestApp, TestApp } from './utils/create-test-app';
import {
  createComment,
  createGame,
  createRequest,
  createUser,
  notificationsOf,
  TestUser,
} from './utils/factories';
import { resetState } from './utils/reset';
import { waitFor } from './utils/wait-for';

describe('Comments (e2e)', () => {
  let t: TestApp;
  let author: TestUser;
  let requestId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
    author = await createUser(t);
    const game = await createGame(t);
    requestId = (await createRequest(t, author, game.id)).id;
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('returns comments as a thread with replies nested under their parent', async () => {
    const other = await createUser(t);
    const root = await createComment(t, author, requestId, { content: 'root' });
    await createComment(t, other, requestId, { content: 'reply', parentId: root.id });
    await createComment(t, author, requestId, { content: 'second root' });

    const res = await t.http().get(`/api/v1/requests/${requestId}/comments`).expect(200);

    expect(res.body.map((c: { content: string }) => c.content)).toEqual(['root', 'second root']);
    expect(res.body[0].replies.map((c: { content: string }) => c.content)).toEqual(['reply']);
    expect(res.body[0].author).toEqual({ id: author.user.id, username: author.user.username, avatarUrl: null });
  });

  it('shows hasLiked for the signed-in viewer', async () => {
    const liker = await createUser(t);
    const comment = await createComment(t, author, requestId);
    await t
      .http()
      .put(`/api/v1/comments/${comment.id}/like`)
      .set('Authorization', `Bearer ${liker.token}`)
      .expect(200);

    const res = await t
      .http()
      .get(`/api/v1/requests/${requestId}/comments`)
      .set('Authorization', `Bearer ${liker.token}`)
      .expect(200);
    expect(res.body[0]).toMatchObject({ hasLiked: true, likeCount: 1 });
  });

  it('a reply to a parent from another request is 404', async () => {
    const game = await createGame(t);
    const otherRequest = await createRequest(t, author, game.id);
    const parentElsewhere = await createComment(t, author, otherRequest.id);

    await t
      .http()
      .post(`/api/v1/requests/${requestId}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'misplaced reply', parentId: parentElsewhere.id })
      .expect(404);
  });

  it(`allows replies ${MAX_COMMENT_DEPTH} levels below a root comment, then 403`, async () => {
    let parent = await createComment(t, author, requestId, { content: 'level 0' });
    for (let level = 1; level <= MAX_COMMENT_DEPTH; level++) {
      parent = await createComment(t, author, requestId, { content: `level ${level}`, parentId: parent.id });
    }

    await t
      .http()
      .post(`/api/v1/requests/${requestId}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'too deep', parentId: parent.id })
      .expect(403);
  });

  it('commenting on a missing request is 404; empty content is 400', async () => {
    const post = (id: string, content: string) =>
      t
        .http()
        .post(`/api/v1/requests/${id}/comments`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ content });
    await post('cmissingidmissingidmissin', 'hello').expect(404);
    await post(requestId, '').expect(400);
    await t.http().get('/api/v1/requests/cmissingidmissingidmissin/comments').expect(404);
  });

  it("notifies the request's author about someone else's comment, not about their own", async () => {
    const commenter = await createUser(t);
    await createComment(t, author, requestId);
    await createComment(t, commenter, requestId);

    const notes = await waitFor(async () => {
      const n = await notificationsOf(t, author.user.id, 'COMMENT_ON_REQUEST');
      expect(n).toHaveLength(1);
      return n;
    });
    expect(notes[0].message).toContain(commenter.user.username);
  });
});
