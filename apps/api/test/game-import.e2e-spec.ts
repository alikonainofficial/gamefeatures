import { createTestApp, TestApp } from './utils/create-test-app';
import { createUser, TestUser } from './utils/factories';
import { resetState } from './utils/reset';

// F16: any logged-in user could import any number of games, and imports had no timeout.
describe('Game import from RAWG (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(t);
    for (let id = 1; id <= 12; id++) {
      t.rawg.add({ id, name: `Imported Game ${id}` });
    }
  });

  afterAll(async () => {
    await t.app.close();
  });

  const importGame = (u: TestUser, externalId: number) =>
    t
      .http()
      .post(`/api/v1/games/import/${externalId}`)
      .set('Authorization', `Bearer ${u.token}`);

  it('allows 10 imports per user per hour, then 429; other users are unaffected', async () => {
    const [alice, bob] = [await createUser(t), await createUser(t)];

    for (let id = 1; id <= 10; id++) {
      await importGame(alice, id).expect(201);
    }
    await importGame(alice, 11).expect(429);

    await importGame(bob, 11).expect(201);
  });

  it('importing an already-imported game returns the existing game', async () => {
    const me = await createUser(t);
    const first = await importGame(me, 3).expect(201);
    const second = await importGame(me, 3).expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(await t.prisma.game.count({ where: { externalId: '3' } })).toBe(1);
  });

  it('parallel imports of the same game both succeed with a single row', async () => {
    const [a, b] = [await createUser(t), await createUser(t)];
    const [ra, rb] = await Promise.all([importGame(a, 5), importGame(b, 5)]);

    expect([ra.status, rb.status]).toEqual([201, 201]);
    expect(ra.body.id).toBe(rb.body.id);
    expect(await t.prisma.game.count({ where: { externalId: '5' } })).toBe(1);
  });

  it('a game RAWG does not know is 404', async () => {
    const me = await createUser(t);
    await importGame(me, 999).expect(404);
  });

  it('requires authentication', async () => {
    await t.http().post('/api/v1/games/import/1').expect(401);
  });
});
