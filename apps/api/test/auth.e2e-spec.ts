import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser, TEST_PASSWORD } from './utils/factories';
import { resetState } from './utils/reset';

describe('Auth flows (e2e)', () => {
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

  const register = (email: string, username: string) =>
    t.http().post('/api/v1/auth/register').send({ email, username, password: TEST_PASSWORD });
  const login = (email: string, password: string) =>
    t.http().post('/api/v1/auth/login').send({ email, password });
  const cookieFrom = (res: { headers: Record<string, unknown> }) =>
    ([] as string[]).concat((res.headers['set-cookie'] as string[]) ?? []).find((c) => c.startsWith('refreshToken='));

  it('register with a taken email is 409', async () => {
    const { email } = await createUser(t);
    const res = await register(email, 'another_name').expect(409);
    expect(res.body.message).toBe('Email already in use');
  });

  it('register with a taken username is 409', async () => {
    await createUser(t, { username: 'taken_user' });
    const res = await register('someone@test.dev', 'taken_user').expect(409);
    expect(res.body.message).toBe('Username already taken');
  });

  it('register validates the body (400)', async () => {
    await t
      .http()
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', username: 'ok_name', password: 'short' })
      .expect(400);
  });

  it('login with a wrong password or unknown email is 401 with the same message', async () => {
    const { email } = await createUser(t);
    const wrong = await login(email, 'not-the-password').expect(401);
    const unknown = await login('nobody@test.dev', TEST_PASSWORD).expect(401);
    expect(wrong.body.message).toBe('Invalid credentials');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('login works and sets an HTTP-only refresh cookie', async () => {
    const { email } = await createUser(t);
    const res = await login(email, TEST_PASSWORD).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(cookieFrom(res)).toMatch(/HttpOnly/i);
    expect(cookieFrom(res)).toMatch(/SameSite=Lax/i);
  });

  it('logout clears the cookie, after which refresh is 401', async () => {
    const { email } = await createUser(t);
    const res = await login(email, TEST_PASSWORD).expect(200);
    const token = cookieFrom(res)!.split(';')[0].split('=')[1];

    const out = await t
      .http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .set('Cookie', `refreshToken=${token}`)
      .expect(200);

    expect(cookieFrom(out)).toMatch(/^refreshToken=;/);
    await t.http().post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${token}`).expect(401);
  });

  it('logout without a cookie revokes every session of the user', async () => {
    const { email } = await createUser(t);
    const a = await login(email, TEST_PASSWORD).expect(200);
    const b = await login(email, TEST_PASSWORD).expect(200);
    const tokenB = cookieFrom(b)!.split(';')[0].split('=')[1];

    await t
      .http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${a.body.accessToken}`)
      .expect(200);

    await t.http().post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${tokenB}`).expect(401);
  });

  it('refresh without a cookie or with garbage is 401', async () => {
    await t.http().post('/api/v1/auth/refresh').expect(401);
    await t.http().post('/api/v1/auth/refresh').set('Cookie', 'refreshToken=garbage').expect(401);
  });
});
