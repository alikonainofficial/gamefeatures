import { createTestApp, TestApp } from './utils/create-test-app';
import { resetState } from './utils/reset';

// 6.1: Render's health check (and the web app's cold-start banner) call GET /api/v1/health.
describe('Health (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('is 200 with db and redis up', async () => {
    const res = await t.http().get('/api/v1/health').expect(200);

    expect(res.body).toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
      uptime: expect.any(Number),
    });
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('is 503 when the database check fails', async () => {
    jest.spyOn(t.prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));

    const res = await t.http().get('/api/v1/health').expect(503);

    expect(res.body).toMatchObject({ status: 'error', db: 'down', redis: 'up' });
  });

  it('is 503 when the Redis check fails', async () => {
    jest.spyOn(t.redis, 'ping').mockRejectedValueOnce(new Error('connection refused'));

    const res = await t.http().get('/api/v1/health').expect(503);

    expect(res.body).toMatchObject({ status: 'error', db: 'up', redis: 'down' });
  });

  it('does not leak error details', async () => {
    jest.spyOn(t.prisma, '$queryRaw').mockRejectedValueOnce(new Error('password=hunter2'));

    const res = await t.http().get('/api/v1/health').expect(503);

    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });
});

describe('Health (e2e) with a low global rate limit', () => {
  let t: TestApp;
  const saved = process.env.THROTTLE_LIMIT;

  beforeAll(async () => {
    // Must be set before the app is built (ThrottlerModule reads it at startup).
    process.env.THROTTLE_LIMIT = '2';
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  afterAll(async () => {
    await t.app.close();
    process.env.THROTTLE_LIMIT = saved;
  });

  it('is never throttled, so health checks and the wake-up poll keep working', async () => {
    for (let i = 0; i < 5; i++) {
      await t.http().get('/api/v1/health').expect(200);
    }
    // Sanity check: the low limit does apply to other routes.
    await t.http().get('/api/v1/games').expect(200);
    await t.http().get('/api/v1/games').expect(200);
    await t.http().get('/api/v1/games').expect(429);
  });
});
