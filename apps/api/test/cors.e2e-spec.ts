import { createTestApp, TestApp } from './utils/create-test-app';

// 6.3: WEB_URL may be a comma-separated list (e.g. the Vercel URL and localhost). Each listed
// origin gets CORS with credentials; anything else gets no CORS headers.
describe('CORS with several web origins (e2e)', () => {
  let t: TestApp;
  const saved = process.env.WEB_URL;

  beforeAll(async () => {
    // Must be set before the app is built (configureApp reads it).
    process.env.WEB_URL = 'https://gamefeatures.example, http://localhost:3000';
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
    process.env.WEB_URL = saved;
  });

  const preflight = (origin: string) =>
    t
      .http()
      .options('/api/v1/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');

  it.each(['https://gamefeatures.example', 'http://localhost:3000'])(
    'allows the listed origin %s with credentials',
    async (origin) => {
      const res = await preflight(origin).expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    },
  );

  it('does not allow an unlisted origin', async () => {
    const res = await preflight('https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
