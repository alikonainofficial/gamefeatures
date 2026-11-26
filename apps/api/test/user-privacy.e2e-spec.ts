import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { resetState } from './utils/reset';

const PRIVATE_KEYS = ['email', 'googleId', 'twitchId', 'isAdmin', 'passwordHash'];

// F7: the public profile spread the whole user row, including email, OAuth IDs and isAdmin.
describe('User privacy (e2e)', () => {
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

  it('GET /users/:username exposes only public fields', async () => {
    const { user } = await createUser(t, { username: 'public_person', isAdmin: true });
    await t.prisma.user.update({
      where: { id: user.id },
      data: { googleId: 'google-123', twitchId: 'twitch-456' },
    });

    const res = await t.http().get('/api/v1/users/public_person').expect(200);

    for (const key of PRIVATE_KEYS) {
      expect(res.body).not.toHaveProperty(key);
    }
    expect(res.body).toMatchObject({
      id: user.id,
      username: 'public_person',
      userType: 'GAMER',
      followersCount: 0,
      followingCount: 0,
      requestsCount: 0,
    });
    expect(res.body).toHaveProperty('avatarUrl');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('GET /auth/me returns your own email and isAdmin, but no OAuth IDs or password hash', async () => {
    const { user, token, email } = await createUser(t);
    await t.prisma.user.update({ where: { id: user.id }, data: { googleId: 'google-123' } });

    const res = await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: user.id, email, isAdmin: false });
    expect(res.body).not.toHaveProperty('googleId');
    expect(res.body).not.toHaveProperty('twitchId');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('PATCH /users/me returns the same self view', async () => {
    const { token, email } = await createUser(t);

    const res = await t
      .http()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'renamed_me' })
      .expect(200);

    expect(res.body).toMatchObject({ username: 'renamed_me', email, isAdmin: false });
    expect(res.body).not.toHaveProperty('googleId');
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});
