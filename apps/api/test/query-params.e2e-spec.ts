import { EntityType, NotificationType } from '@game-review/database';
import { createTestApp, TestApp } from './utils/create-test-app';
import { createGame, createRequest, createUser } from './utils/factories';
import { resetState } from './utils/reset';

// F1: extra query keys (sort, search, unread) were rejected with 400 by the global
// ValidationPipe (forbidNonWhitelisted) because the controllers only declared PaginationDto.
describe('List query parameters (e2e)', () => {
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

  describe('GET /games', () => {
    it('accepts search together with pagination and filters by name', async () => {
      await createGame(t, { name: 'Portal 2' });
      await createGame(t, { name: 'Portal' });
      await createGame(t, { name: 'Half-Life' });

      const res = await t.http().get('/api/v1/games?search=portal&limit=8').expect(200);

      expect(res.body.data.map((g: { name: string }) => g.name).sort()).toEqual([
        'Portal',
        'Portal 2',
      ]);
      expect(res.body.meta.limit).toBe(8);
    });

    it('rejects an overlong search', async () => {
      await t
        .http()
        .get(`/api/v1/games?search=${'a'.repeat(101)}`)
        .expect(400);
    });
  });

  describe('GET /games/:slug/requests', () => {
    it.each(['hot', 'top', 'new'])('accepts sort=%s with pagination', async (sort) => {
      const author = await createUser(t);
      const game = await createGame(t);
      await createRequest(t, author, game.id);

      const res = await t
        .http()
        .get(`/api/v1/games/${game.slug}/requests?sort=${sort}&page=1&limit=10`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
    });

    it('defaults to a valid sort when none is given', async () => {
      const game = await createGame(t);
      await t.http().get(`/api/v1/games/${game.slug}/requests`).expect(200);
    });

    it('rejects an unknown sort with 400', async () => {
      const game = await createGame(t);
      await t.http().get(`/api/v1/games/${game.slug}/requests?sort=bogus`).expect(400);
    });
  });

  describe('GET /me/notifications', () => {
    async function seedNotifications(userId: string) {
      const base = {
        userId,
        type: NotificationType.COMMENT_ON_REQUEST,
        entityType: EntityType.REQUEST,
        entityId: 'some-request',
        message: 'Someone commented',
      };
      await t.prisma.notification.createMany({
        data: [
          { ...base, title: 'unread one', isRead: false },
          { ...base, title: 'read one', isRead: true },
        ],
      });
    }

    it('unread=false returns read and unread notifications', async () => {
      const { user, token } = await createUser(t);
      await seedNotifications(user.id);

      const res = await t
        .http()
        .get('/api/v1/me/notifications?unread=false&page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.map((n: { title: string }) => n.title).sort()).toEqual([
        'read one',
        'unread one',
      ]);
    });

    it('unread=true returns only unread notifications', async () => {
      const { user, token } = await createUser(t);
      await seedNotifications(user.id);

      const res = await t
        .http()
        .get('/api/v1/me/notifications?unread=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.map((n: { title: string }) => n.title)).toEqual(['unread one']);
    });

    it('rejects a non-boolean unread value', async () => {
      const { token } = await createUser(t);
      await t
        .http()
        .get('/api/v1/me/notifications?unread=maybe')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });
});
