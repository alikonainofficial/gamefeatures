import { Game, RequestType, User, UserType } from '@game-review/database';
import { TestApp } from './create-test-app';

let sequence = 0;
const next = () => `${Date.now().toString(36)}${++sequence}`;

export const TEST_PASSWORD = 'correct-horse-battery';

export interface TestUser {
  user: User;
  token: string;
  email: string;
  password: string;
}

/** Registers through the real HTTP endpoint and returns the user with a valid access token. */
export async function createUser(
  t: TestApp,
  opts: { username?: string; isAdmin?: boolean; userType?: UserType } = {},
): Promise<TestUser> {
  const username = opts.username ?? `user_${next()}`;
  const email = `${username.toLowerCase()}@test.dev`;

  const res = await t
    .http()
    .post('/api/v1/auth/register')
    .send({ email, username, password: TEST_PASSWORD })
    .expect(201);
  const token: string = res.body.accessToken;

  let user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
  if (opts.isAdmin !== undefined || opts.userType !== undefined) {
    user = await t.prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: opts.isAdmin, userType: opts.userType },
    });
  }

  return { user, token, email, password: TEST_PASSWORD };
}

/** Inserts a game directly (games normally come from a RAWG import). */
export async function createGame(t: TestApp, overrides: Partial<Game> = {}): Promise<Game> {
  const id = next();
  return t.prisma.game.create({
    data: {
      externalId: `ext-${id}`,
      slug: `game-${id}`,
      name: `Game ${id}`,
      platforms: ['PC'],
      genres: ['Action'],
      ...overrides,
    },
  });
}

/** Creates a feature request through the real HTTP endpoint. */
export async function createRequest(
  t: TestApp,
  author: TestUser,
  gameId: string,
  overrides: { title?: string; description?: string; type?: RequestType } = {},
) {
  const res = await t
    .http()
    .post('/api/v1/requests')
    .set('Authorization', `Bearer ${author.token}`)
    .send({
      gameId,
      type: RequestType.ADD_FEATURE,
      title: `Request ${next()}`,
      description: 'A description that is long enough to pass validation.',
      ...overrides,
    })
    .expect(201);
  return res.body;
}
