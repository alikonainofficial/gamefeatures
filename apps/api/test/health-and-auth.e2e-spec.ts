import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { resetState } from './utils/reset';

describe('Auth (e2e)', () => {
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

  it('register returns a token that GET /auth/me accepts', async () => {
    const { token, user } = await createUser(t, { username: 'first_player' });

    const res = await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.username).toBe('first_player');
    expect(res.body.id).toBe(user.id);
  });

  it('GET /auth/me without a token is 401', async () => {
    await t.http().get('/api/v1/auth/me').expect(401);
  });
});
