import { createTestApp, TestApp } from './utils/create-test-app';
import { TEST_PASSWORD } from './utils/factories';
import { resetState } from './utils/reset';

// F6 (partly): with no Prisma error mapping, races on unique constraints surfaced as 500s.
describe('Prisma errors map to HTTP codes (e2e)', () => {
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

  it('registering the same username twice in parallel gives one 201 and one 409, never 500', async () => {
    // Different emails, so only the username's unique constraint can catch the second insert.
    const register = (email: string) =>
      t
        .http()
        .post('/api/v1/auth/register')
        .send({ email, username: 'racer', password: TEST_PASSWORD });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      await resetState(t);
      const results = await Promise.all([
        register(`a${attempt}@test.dev`),
        register(`b${attempt}@test.dev`),
      ]);
      statuses.push(...results.map((r) => r.status));
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    }
    expect(statuses).not.toContain(500);
  });

  it('four parallel registrations with one username: one 201, three readable 409s', async () => {
    // Some lose at the service's pre-check, some at the database's unique constraint;
    // both must come back as 409 with a string message.
    const res = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        t
          .http()
          .post('/api/v1/auth/register')
          .send({ email: `same-${i}@test.dev`, username: 'samename', password: TEST_PASSWORD }),
      ),
    );
    expect(res.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    const conflicts = res.filter((r) => r.status === 409);
    for (const c of conflicts) {
      expect(c.body.statusCode).toBe(409);
      expect(typeof c.body.message).toBe('string');
    }
  });
});
