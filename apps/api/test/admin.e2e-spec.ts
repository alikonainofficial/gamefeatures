import { UserType } from '@game-review/database';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createUser, TestUser } from './utils/factories';
import { resetState } from './utils/reset';

describe('Admin: developer access (e2e)', () => {
  let t: TestApp;
  let admin: TestUser;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
    admin = await createUser(t, { isAdmin: true });
  });

  afterAll(async () => {
    await t.app.close();
  });

  const grant = (as: TestUser, gameId: string, userId: string) =>
    t
      .http()
      .post(`/api/v1/admin/games/${gameId}/grant-access`)
      .set('Authorization', `Bearer ${as.token}`)
      .send({ userId });
  const revoke = (as: TestUser, gameId: string) =>
    t
      .http()
      .delete(`/api/v1/admin/games/${gameId}/revoke-access`)
      .set('Authorization', `Bearer ${as.token}`);
  const userType = async (id: string) =>
    (await t.prisma.user.findUniqueOrThrow({ where: { id } })).userType;

  it('non-admins get 403 on every admin route', async () => {
    const gamer = await createUser(t);
    const game = await createGame(t);
    await grant(gamer, game.id, gamer.user.id).expect(403);
    await revoke(gamer, game.id).expect(403);
    await t
      .http()
      .get('/api/v1/admin/games/with-dev-access')
      .set('Authorization', `Bearer ${gamer.token}`)
      .expect(403);
    await t
      .http()
      .post(`/api/v1/admin/users/${gamer.user.id}/make-admin`)
      .set('Authorization', `Bearer ${gamer.token}`)
      .expect(403);
  });

  it('grant makes the user a DEVELOPER and verifies the game', async () => {
    const dev = await createUser(t);
    const game = await createGame(t);

    const res = await grant(admin, game.id, dev.user.id).expect(201);

    expect(res.body).toMatchObject({ isVerified: true, devUserId: dev.user.id });
    expect(await userType(dev.user.id)).toBe(UserType.DEVELOPER);
  });

  it('grant fails for a game that already has a developer (400) or missing ids (404)', async () => {
    const [dev, other] = [await createUser(t), await createUser(t)];
    const game = await createGame(t);
    await grant(admin, game.id, dev.user.id).expect(201);

    await grant(admin, game.id, other.user.id).expect(400);
    await grant(admin, 'cmissingidmissingidmissin', dev.user.id).expect(404);
    await grant(admin, (await createGame(t)).id, 'cmissingidmissingidmissin').expect(404);
  });

  it('revoke turns the user back into a GAMER when they have no other games', async () => {
    const dev = await createUser(t);
    const game = await createGame(t);
    await grant(admin, game.id, dev.user.id).expect(201);

    await revoke(admin, game.id).expect(200);

    expect(await userType(dev.user.id)).toBe(UserType.GAMER);
    expect((await t.prisma.game.findUniqueOrThrow({ where: { id: game.id } })).isVerified).toBe(false);
  });

  it('revoke keeps DEVELOPER while the user still manages another game', async () => {
    const dev = await createUser(t);
    const [first, second] = [await createGame(t), await createGame(t)];
    await grant(admin, first.id, dev.user.id).expect(201);
    await grant(admin, second.id, dev.user.id).expect(201);

    await revoke(admin, first.id).expect(200);
    expect(await userType(dev.user.id)).toBe(UserType.DEVELOPER);
  });

  it('revoke on a game without a developer is 400; on a missing game 404', async () => {
    await revoke(admin, (await createGame(t)).id).expect(400);
    await revoke(admin, 'cmissingidmissingidmissin').expect(404);
  });

  it('lists games with developer access', async () => {
    const dev = await createUser(t);
    const game = await createGame(t);
    await createGame(t);
    await grant(admin, game.id, dev.user.id).expect(201);

    const res = await t
      .http()
      .get('/api/v1/admin/games/with-dev-access')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ id: game.id, devUser: { id: dev.user.id } });
  });

  it('make-admin promotes a user; a missing user is 404', async () => {
    const user = await createUser(t);
    await t
      .http()
      .post(`/api/v1/admin/users/${user.user.id}/make-admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: user.user.id } })).isAdmin).toBe(true);

    await t
      .http()
      .post('/api/v1/admin/users/cmissingidmissingidmissin/make-admin')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });
});
