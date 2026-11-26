import { Logger } from '@nestjs/common';
import { createTestApp, TestApp } from './utils/create-test-app';

/**
 * Production runs with TRUST_PROXY_HOPS=2 (browser -> Vercel rewrite -> Render's proxy -> API).
 * The API then sees `X-Forwarded-For: <client>, <vercel>` on a socket from Render's proxy, and
 * Express must pick <client>. LOG_CLIENT_IP=true logs what it picked, so the deploy runbook can
 * verify the setting without a code change. (Here the supertest socket plays Render's proxy.)
 */
describe('Client IP behind two proxies (e2e)', () => {
  let t: TestApp;
  const saved = { hops: process.env.TRUST_PROXY_HOPS, log: process.env.LOG_CLIENT_IP };
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env.TRUST_PROXY_HOPS = '2';
    process.env.LOG_CLIENT_IP = 'true';
    t = await createTestApp();
  });

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  afterAll(async () => {
    await t.app.close();
    process.env.TRUST_PROXY_HOPS = saved.hops;
    process.env.LOG_CLIENT_IP = saved.log;
  });

  const loggedLines = () => logSpy.mock.calls.map((call) => String(call[0]));

  it('resolves the client from "client, vercel" and logs it', async () => {
    await t
      .http()
      .get('/api/v1/health')
      .set('X-Forwarded-For', '198.51.100.23, 203.0.113.50')
      .expect(200);

    expect(loggedLines()).toContainEqual(
      expect.stringContaining('ip=198.51.100.23 x-forwarded-for="198.51.100.23, 203.0.113.50"'),
    );
  });

  it('ignores extra entries a client prepends (only the last two hops are trusted)', async () => {
    await t
      .http()
      .get('/api/v1/health')
      .set('X-Forwarded-For', '10.9.9.9, 198.51.100.23, 203.0.113.50')
      .expect(200);

    expect(loggedLines()).toContainEqual(expect.stringContaining('ip=198.51.100.23 '));
  });
});

describe('Client IP logging is off by default (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('logs nothing about client IPs', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await t.http().get('/api/v1/health').set('X-Forwarded-For', '198.51.100.23').expect(200);
    expect(logSpy.mock.calls.map((c) => String(c[0]))).not.toContainEqual(
      expect.stringContaining('x-forwarded-for='),
    );
    logSpy.mockRestore();
  });
});
