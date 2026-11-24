import { NotificationsGateway } from '../src/modules/notifications/notifications.gateway';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { resetState } from './utils/reset';
import { closeAllSockets, collect, connectedSocket, openSocket, settle } from './utils/socket';

// F8: any socket could join any room, including `user:<someoneElse>`, and read their
// private notifications.
describe('WebSocket room subscriptions (e2e)', () => {
  let t: TestApp;
  let gateway: NotificationsGateway;

  beforeAll(async () => {
    t = await createTestApp();
    gateway = t.app.get(NotificationsGateway);
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

  it("cannot subscribe to another user's private room or receive their notifications", async () => {
    const attacker = await createUser(t);
    const victim = await createUser(t);
    const attackerSocket = await connectedSocket(t, attacker);
    const victimSocket = await connectedSocket(t, victim);
    const attackerGot = collect(attackerSocket, 'notification');
    const victimGot = collect(victimSocket, 'notification');

    const ack = await attackerSocket.emitWithAck('subscribe', { room: `user:${victim.user.id}` });
    expect(ack).toEqual({ error: 'Invalid room' });

    gateway.sendToUser(victim.user.id, { type: 'notification', payload: { secret: 'for victim' } });
    await settle();

    expect(victimGot).toEqual([{ secret: 'for victim' }]); // positive control
    expect(attackerGot).toEqual([]);
  });

  it.each([
    ['no payload', undefined],
    ['a non-string room', { room: 42 }],
    ['an arbitrary room', { room: 'admins' }],
    ['a request room with a malformed id', { room: 'request:../../user:abc' }],
  ])('rejects %s', async (_, payload) => {
    const me = await createUser(t);
    const socket = await connectedSocket(t, me);
    expect(await socket.emitWithAck('subscribe', payload)).toEqual({ error: 'Invalid room' });
  });

  it('allows subscribing to a request room and receives its vote updates', async () => {
    const me = await createUser(t);
    const socket = await connectedSocket(t, me);
    const updates = collect(socket, 'vote_update');
    const requestId = 'cmwu53p7i00h312nm3hp1jzud';

    expect(await socket.emitWithAck('subscribe', { room: `request:${requestId}` })).toEqual({
      subscribed: `request:${requestId}`,
    });
    gateway.sendVoteUpdate(requestId, 7);
    await settle();
    expect(updates).toEqual([{ requestId, voteCount: 7 }]);

    expect(await socket.emitWithAck('unsubscribe', { room: `request:${requestId}` })).toEqual({
      unsubscribed: `request:${requestId}`,
    });
    gateway.sendVoteUpdate(requestId, 8);
    await settle();
    expect(updates).toHaveLength(1);
  });

  it('disconnects a connection without a valid token', async () => {
    for (const token of [undefined, 'not-a-jwt']) {
      const socket = openSocket(t, token);
      const reason = await new Promise<string>((resolve) => socket.once('disconnect', resolve));
      expect(reason).toBe('io server disconnect');
    }
  });
});
