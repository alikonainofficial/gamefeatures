import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser, TEST_PASSWORD } from './utils/factories';
import { resetState } from './utils/reset';

// F12: PATCH /users/me accepted any username up to 100 chars, and a duplicate returned 500.
describe('Username validation (e2e)', () => {
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

  const patchMe = (token: string, username: string) =>
    t
      .http()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username });

  it.each([
    ['contains a space', 'a b'],
    ['is too short', 'ab'],
    ['is too long', 'a'.repeat(31)],
    ['has punctuation', 'bad-name!'],
  ])('PATCH /users/me rejects a username that %s (400)', async (_, username) => {
    const { token } = await createUser(t);
    await patchMe(token, username).expect(400);
  });

  it('PATCH /users/me accepts a valid username', async () => {
    const { token } = await createUser(t);
    const res = await patchMe(token, 'New_Name_30').expect(200);
    expect(res.body.username).toBe('New_Name_30');
  });

  it('PATCH /users/me with a taken username is 409', async () => {
    await createUser(t, { username: 'taken_name' });
    const { token } = await createUser(t);
    await patchMe(token, 'taken_name').expect(409);
  });

  it('register applies the same rules', async () => {
    const register = (username: string) =>
      t
        .http()
        .post('/api/v1/auth/register')
        .send({ email: `${Date.now()}@test.dev`, username, password: TEST_PASSWORD });

    await register('a b').expect(400);
    await register('ab').expect(400);
    await register('a'.repeat(31)).expect(400);
    await register('fine_name').expect(201);
  });
});
