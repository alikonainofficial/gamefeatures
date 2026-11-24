import { createHash } from 'crypto';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { resetState } from './utils/reset';

/** Pulls the refreshToken value out of a Set-Cookie header. */
function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = ([] as string[]).concat((res.headers['set-cookie'] as string[]) ?? []);
  const match = cookies.map((c) => c.match(/^refreshToken=([^;]+)/)).find(Boolean);
  if (!match) throw new Error('No refreshToken cookie set');
  return match[1];
}

// F10: refresh tokens were stored in plaintext, and two logins in the same second produced
// identical JWTs, so the second hit `token @unique` (500, or 409 since 2.4).
describe('Refresh tokens (e2e)', () => {
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

  const login = (email: string, password: string) =>
    t.http().post('/api/v1/auth/login').send({ email, password });
  const refresh = (token: string) =>
    t.http().post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${token}`);

  it('two logins for the same user in the same second both succeed with different tokens', async () => {
    const { email, password } = await createUser(t);
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-24T10:00:00.000Z'));

    const first = await login(email, password).expect(200);
    const second = await login(email, password).expect(200);

    expect(refreshCookie(first)).not.toBe(refreshCookie(second));
  });

  it('refresh rotates the token: the new cookie works, the old one is rejected', async () => {
    const { email, password } = await createUser(t);
    const original = refreshCookie(await login(email, password).expect(200));

    const rotated = await refresh(original).expect(200);
    expect(rotated.body.accessToken).toEqual(expect.any(String));
    const next = refreshCookie(rotated);
    expect(next).not.toBe(original);

    await refresh(original).expect(401);
    await refresh(next).expect(200);
  });

  it('only one of two parallel refreshes with the same token succeeds', async () => {
    const { email, password } = await createUser(t);
    const token = refreshCookie(await login(email, password).expect(200));

    const results = await Promise.all([refresh(token), refresh(token)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('stores only a hash of each refresh token', async () => {
    const { email, password, user } = await createUser(t);
    const token = refreshCookie(await login(email, password).expect(200));

    const rows = await t.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "RefreshToken" WHERE "userId" = ${user.id}
    `;
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(token);
    expect(stored).toContain(createHash('sha256').update(token).digest('hex'));
  });

  it("deletes the user's expired refresh tokens on login", async () => {
    const { email, password, user } = await createUser(t);
    await t.prisma.$executeRaw`
      UPDATE "RefreshToken" SET "expiresAt" = NOW() - INTERVAL '1 day' WHERE "userId" = ${user.id}
    `;

    await login(email, password).expect(200);

    const expired = await t.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "RefreshToken"
      WHERE "userId" = ${user.id} AND "expiresAt" < NOW()
    `;
    expect(Number(expired[0].count)).toBe(0);
  });

  it('logout revokes the refresh token', async () => {
    const { email, password } = await createUser(t);
    const res = await login(email, password).expect(200);
    const token = refreshCookie(res);

    await t
      .http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .set('Cookie', `refreshToken=${token}`)
      .expect(200);

    await refresh(token).expect(401);
  });
});
