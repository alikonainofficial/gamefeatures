import { EntityType, NotificationType } from '@game-review/database';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser, TestUser } from './utils/factories';
import { resetState } from './utils/reset';

describe('Notifications (e2e)', () => {
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
  const notify = (userId: string, title: string) =>
    t.prisma.notification.create({
      data: {
        userId,
        title,
        type: NotificationType.COMMENT_ON_REQUEST,
        entityType: EntityType.REQUEST,
        entityId: 'some-request',
        message: 'message',
      },
    });
  const isRead = async (id: string) =>
    (await t.prisma.notification.findUniqueOrThrow({ where: { id } })).isRead;

  it('requires authentication', async () => {
    await t.http().get('/api/v1/me/notifications').expect(401);
  });

  it("marking someone else's notification as read changes nothing", async () => {
    const [me, other] = [await createUser(t), await createUser(t)];
    const theirs = await notify(other.user.id, 'theirs');

    await t.http().patch(`/api/v1/me/notifications/${theirs.id}/read`).set(...auth(me)).expect(200);
    expect(await isRead(theirs.id)).toBe(false);
  });

  it('marks your own notification as read', async () => {
    const me = await createUser(t);
    const mine = await notify(me.user.id, 'mine');

    await t.http().patch(`/api/v1/me/notifications/${mine.id}/read`).set(...auth(me)).expect(200);
    expect(await isRead(mine.id)).toBe(true);
  });

  it('read-all only affects your own notifications', async () => {
    const [me, other] = [await createUser(t), await createUser(t)];
    const mine = [await notify(me.user.id, 'a'), await notify(me.user.id, 'b')];
    const theirs = await notify(other.user.id, 'c');

    await t.http().post('/api/v1/me/notifications/read-all').set(...auth(me)).expect(201);

    expect(await Promise.all(mine.map((n) => isRead(n.id)))).toEqual([true, true]);
    expect(await isRead(theirs.id)).toBe(false);

    const res = await t.http().get('/api/v1/me/notifications').set(...auth(me)).expect(200);
    expect(res.body.meta).toMatchObject({ total: 2, unreadCount: 0 });
  });

  it('registers a device token, moving it to the latest user who registers it', async () => {
    const [a, b] = [await createUser(t), await createUser(t)];
    const register = (u: TestUser) =>
      t.http().post('/api/v1/me/device-tokens').set(...auth(u)).send({ token: 'device-token-123' });

    await register(a).expect(201);
    await register(b).expect(201);

    const tokens = await t.prisma.deviceToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].userId).toBe(b.user.id);
  });
});
