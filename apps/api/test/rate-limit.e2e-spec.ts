import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { resetState } from './utils/reset';

// F9: ThrottlerModule was registered without ThrottlerGuard, so login could be brute-forced.
describe('Rate limiting (e2e)', () => {
  let t: TestApp;
  const saved = process.env.AUTH_THROTTLE_LIMIT;

  beforeAll(async () => {
    // Must be set before the app is built. The rest of the suite runs with high limits
    // (test/.env.test) so it isn't throttled.
    process.env.AUTH_THROTTLE_LIMIT = '3';
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  afterAll(async () => {
    await t.app.close();
    process.env.AUTH_THROTTLE_LIMIT = saved;
  });

  it('the 4th bad login from one client within the window is 429', async () => {
    const { email } = await createUser(t);
    const badLogin = () =>
      t.http().post('/api/v1/auth/login').send({ email, password: 'wrong-password-1' });

    for (let i = 0; i < 3; i++) {
      await badLogin().expect(401);
    }
    const blocked = await badLogin().expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('a spoofed X-Forwarded-For does not reset the limit (no proxy is trusted by default)', async () => {
    const { email } = await createUser(t);
    const badLogin = (ip: string) =>
      t
        .http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password: 'wrong-password-1' });

    for (let i = 0; i < 3; i++) {
      await badLogin(`203.0.113.${i}`).expect(401);
    }
    await badLogin('203.0.113.99').expect(429);
  });

  it('the stricter auth limit does not apply to ordinary endpoints', async () => {
    for (let i = 0; i < 6; i++) {
      await t.http().get('/api/v1/games').expect(200);
    }
  });
});
