import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserType } from '@game-review/database';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_REGEX } from '@game-review/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, OAuthProfile } from './auth.service';

/** A Prisma mock with just what validateOAuthUser and token generation touch. */
function setup() {
  const user = {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn(async ({ where, data }) => ({ ...existingUser, id: where.id, ...data })),
    create: jest.fn(async ({ data }) => ({ id: 'new-user', userType: UserType.GAMER, ...data })),
  };
  const refreshToken = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({}),
  };
  const prisma = { user, refreshToken } as unknown as PrismaService;
  const jwt = { sign: jest.fn().mockReturnValue('signed.jwt') } as unknown as JwtService;
  const config = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
  return { service: new AuthService(prisma, jwt, config), user };
}

const existingUser = {
  id: 'existing',
  email: 'player@example.com',
  username: 'player_one',
  userType: UserType.GAMER,
  googleId: null as string | null,
  twitchId: null as string | null,
  avatarUrl: null as string | null,
};

const google = (overrides: Partial<OAuthProfile> = {}): OAuthProfile => ({
  provider: 'google',
  providerId: 'google-123',
  email: 'player@example.com',
  emailVerified: true,
  username: 'Player One',
  ...overrides,
});

const twitch = (overrides: Partial<OAuthProfile> = {}): OAuthProfile => ({
  provider: 'twitch',
  providerId: 'twitch-456',
  email: 'player@example.com',
  emailVerified: true,
  username: 'PlayerOne',
  ...overrides,
});

const uniqueViolation = (field: string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [field] },
  });

describe('AuthService.validateOAuthUser', () => {
  it('signs in the account already linked to the provider ID, without looking at email', async () => {
    const { service, user } = setup();
    user.findUnique.mockImplementation(async ({ where }) =>
      where.googleId === 'google-123' ? { ...existingUser, googleId: 'google-123' } : null,
    );

    const result = await service.validateOAuthUser(google({ email: 'changed@example.com' }));

    expect(result).toEqual({ tokens: expect.objectContaining({ accessToken: 'signed.jwt' }) });
    expect(user.findUnique).toHaveBeenCalledTimes(1);
    expect(user.create).not.toHaveBeenCalled();
  });

  it('links a verified Google email to the existing account', async () => {
    const { service, user } = setup();
    user.findUnique.mockImplementation(async ({ where }) =>
      where.email === existingUser.email ? existingUser : null,
    );

    const result = await service.validateOAuthUser(google());

    expect(result).toHaveProperty('tokens');
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing' },
        data: expect.objectContaining({ googleId: 'google-123' }),
      }),
    );
  });

  it('does not link an unverified Google email; reports account_exists instead', async () => {
    const { service, user } = setup();
    user.findUnique.mockImplementation(async ({ where }) =>
      where.email === existingUser.email ? existingUser : null,
    );

    const result = await service.validateOAuthUser(google({ emailVerified: false }));

    expect(result).toEqual({ error: 'account_exists' });
    expect(user.update).not.toHaveBeenCalled();
    expect(user.create).not.toHaveBeenCalled();
  });

  it('never links by email for Twitch, even when Twitch says it is verified', async () => {
    const { service, user } = setup();
    user.findUnique.mockImplementation(async ({ where }) =>
      where.email === existingUser.email ? existingUser : null,
    );

    expect(await service.validateOAuthUser(twitch())).toEqual({ error: 'account_exists' });
    expect(user.update).not.toHaveBeenCalled();
  });

  it('does not link when the existing account is already linked to another Google ID', async () => {
    const { service, user } = setup();
    user.findUnique.mockImplementation(async ({ where }) =>
      where.email === existingUser.email ? { ...existingUser, googleId: 'someone-else' } : null,
    );

    expect(await service.validateOAuthUser(google())).toEqual({ error: 'account_exists' });
  });

  it('creates a new user when the email is not taken', async () => {
    const { service, user } = setup();

    const result = await service.validateOAuthUser(twitch({ email: 'fresh@example.com' }));

    expect(result).toHaveProperty('tokens');
    expect(user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'fresh@example.com',
        twitchId: 'twitch-456',
        userType: UserType.GAMER,
      }),
    });
  });

  it('fails cleanly when the provider gives no email', async () => {
    const { service, user } = setup();
    expect(await service.validateOAuthUser(twitch({ email: undefined }))).toEqual({
      error: 'email_required',
    });
    expect(user.create).not.toHaveBeenCalled();
  });

  it.each([
    ['spaces and punctuation', 'Mr. Player One!!'],
    ['too short', 'Al'],
    ['empty after cleaning', '🎮🎮'],
    ['too long', 'A'.repeat(60)],
  ])('generates a valid username from a display name with %s', async (_, displayName) => {
    const { service, user } = setup();
    await service.validateOAuthUser(google({ email: 'fresh@example.com', username: displayName }));

    const { username } = user.create.mock.calls[0][0].data;
    expect(username).toMatch(USERNAME_REGEX);
    expect(username.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
    expect(username.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it('retries with a different username when the first one is taken', async () => {
    const { service, user } = setup();
    user.create.mockRejectedValueOnce(uniqueViolation('username'));

    const result = await service.validateOAuthUser(google({ email: 'fresh@example.com' }));

    expect(result).toHaveProperty('tokens');
    const [first, second] = user.create.mock.calls.map((c) => c[0].data.username);
    expect(second).not.toBe(first);
    expect(second).toMatch(USERNAME_REGEX);
    expect(second.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });
});
