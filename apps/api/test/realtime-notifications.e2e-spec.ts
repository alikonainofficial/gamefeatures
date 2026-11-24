import { UserType } from '@game-review/database';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createRequest, createUser } from './utils/factories';
import { resetState } from './utils/reset';
import { closeAllSockets, collect, connectedSocket, settle } from './utils/socket';
import { waitFor } from './utils/wait-for';

// F14: the UI never used the socket. This covers the server half the header badge relies on.
describe('Live notifications and vote counts over Socket.IO (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  afterEach(() => {
    closeAllSockets();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it("the author's socket gets a notification when the game's developer changes the status", async () => {
    const author = await createUser(t);
    const dev = await createUser(t, { userType: UserType.DEVELOPER });
    const bystander = await createUser(t);
    const game = await createGame(t, { devUserId: dev.user.id });
    const request = await createRequest(t, author, game.id);

    const authorSocket = await connectedSocket(t, author);
    const bystanderSocket = await connectedSocket(t, bystander);
    const authorGot = collect<{ title: string; actionUrl: string | null }>(authorSocket, 'notification');
    const bystanderGot = collect(bystanderSocket, 'notification');

    await t
      .http()
      .patch(`/api/v1/requests/${request.id}/status`)
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ status: 'UNDER_REVIEW', devResponse: 'Looking into it' })
      .expect(200);

    await waitFor(() => expect(authorGot).toHaveLength(1));
    expect(authorGot[0].actionUrl).toContain(request.id);

    // The unread count the badge loads on sign-in agrees.
    const res = await t
      .http()
      .get('/api/v1/me/notifications?unread=true&limit=1')
      .set('Authorization', `Bearer ${author.token}`)
      .expect(200);
    expect(res.body.meta.unreadCount).toBe(1);

    await settle();
    expect(bystanderGot).toEqual([]);
  });

  it('a socket watching request:<id> gets vote_update after another user votes and unvotes', async () => {
    const author = await createUser(t);
    const viewer = await createUser(t);
    const voter = await createUser(t);
    const game = await createGame(t);
    const request = await createRequest(t, author, game.id);

    const viewerSocket = await connectedSocket(t, viewer);
    const updates = collect<{ requestId: string; voteCount: number }>(viewerSocket, 'vote_update');
    await viewerSocket.emitWithAck('subscribe', { room: `request:${request.id}` });

    const vote = () =>
      t.http().put(`/api/v1/requests/${request.id}/vote`).set('Authorization', `Bearer ${voter.token}`);
    const unvote = () =>
      t.http().delete(`/api/v1/requests/${request.id}/vote`).set('Authorization', `Bearer ${voter.token}`);

    await vote().expect(200);
    await waitFor(() => expect(updates).toEqual([{ requestId: request.id, voteCount: 1 }]));

    // A repeated PUT changes nothing, so nothing is broadcast.
    await vote().expect(200);
    await settle();
    expect(updates).toHaveLength(1);

    await unvote().expect(200);
    await waitFor(() => expect(updates[1]).toEqual({ requestId: request.id, voteCount: 0 }));
  });

  it('does not send vote updates to sockets that did not subscribe to that request', async () => {
    const author = await createUser(t);
    const other = await createUser(t);
    const game = await createGame(t);
    const request = await createRequest(t, author, game.id);
    const otherSocket = await connectedSocket(t, other);
    const updates = collect(otherSocket, 'vote_update');

    await t
      .http()
      .put(`/api/v1/requests/${request.id}/vote`)
      .set('Authorization', `Bearer ${author.token}`)
      .expect(200);
    await settle();
    expect(updates).toEqual([]);
  });
});
