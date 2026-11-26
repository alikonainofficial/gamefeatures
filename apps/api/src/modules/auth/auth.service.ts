import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Prisma, UserType } from '@game-review/database';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@game-review/shared';
import { isPrismaError } from '../../common/prisma/is-prisma-error';
import { createHash, randomBytes, randomUUID } from 'crypto';

/** Refresh tokens are stored as SHA-256 hashes, so a database leak doesn't leak sessions. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  userType: UserType;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OAuthProfile {
  provider: 'google' | 'twitch';
  /** The provider's stable user ID. */
  providerId: string;
  email?: string;
  /** True only if the provider says it verified the email address. */
  emailVerified: boolean;
  /** Display name, used to derive a username for new accounts. */
  username: string;
  avatarUrl?: string;
}

export type OAuthLoginError = 'account_exists' | 'email_required';
export type OAuthLoginResult = { tokens: AuthTokens } | { error: OAuthLoginError };

/** Turns a display name into something that passes the username rules (2.6). */
function usernameBase(displayName: string): string {
  const cleaned = displayName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX_LENGTH);
  if (cleaned.length === 0) return 'player';
  return cleaned.padEnd(USERNAME_MIN_LENGTH, '_');
}

/** `base_1a2b3c`, trimmed so the result still fits USERNAME_MAX_LENGTH. */
function withRandomSuffix(base: string): string {
  const suffix = `_${randomBytes(3).toString('hex')}`;
  return `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length)}${suffix}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    // Check if email exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    // Check if username exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        userType: UserType.GAMER,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation: claim the stored token by deleting it. deleteMany is atomic, so when two
    // requests race with the same token exactly one sees count === 1; the other gets 401.
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        tokenHash: hashToken(refreshToken),
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    });
    if (count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.generateTokens(user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { tokenHash: hashToken(refreshToken), userId },
      });
    } else {
      // Logout from all sessions
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  /**
   * Signs in (or signs up) a user coming back from Google or Twitch.
   *
   * 1. An account already linked to this provider ID signs in.
   * 2. Otherwise, an account with the same email is linked only if the provider vouches for
   *    the email (Google with `email_verified`). Twitch is never linked by email. Anything
   *    else is reported as `account_exists` instead of handing over someone else's account.
   * 3. Otherwise a new account is created with a valid, unique username.
   */
  async validateOAuthUser(profile: OAuthProfile): Promise<OAuthLoginResult> {
    const providerKey =
      profile.provider === 'google'
        ? { googleId: profile.providerId }
        : { twitchId: profile.providerId };

    const linked = await this.prisma.user.findUnique({ where: providerKey });
    if (linked) {
      const user =
        !linked.avatarUrl && profile.avatarUrl
          ? await this.prisma.user.update({
              where: { id: linked.id },
              data: { avatarUrl: profile.avatarUrl },
            })
          : linked;
      return { tokens: await this.generateTokens(user) };
    }

    if (!profile.email) {
      return { error: 'email_required' };
    }

    const sameEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (sameEmail) {
      const canLink =
        profile.provider === 'google' && profile.emailVerified && !sameEmail.googleId;
      if (!canLink) {
        return { error: 'account_exists' };
      }
      const user = await this.prisma.user.update({
        where: { id: sameEmail.id },
        data: {
          googleId: profile.providerId,
          ...(!sameEmail.avatarUrl && profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
        },
      });
      return { tokens: await this.generateTokens(user) };
    }

    const base = usernameBase(profile.username);
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = attempt === 0 ? base : withRandomSuffix(base);
      try {
        const user = await this.prisma.user.create({
          data: {
            email: profile.email,
            username,
            avatarUrl: profile.avatarUrl,
            ...providerKey,
            userType: UserType.GAMER,
          },
        });
        return { tokens: await this.generateTokens(user) };
      } catch (error) {
        if (!isPrismaError(error, 'P2002')) throw error;
        const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
        // The email was taken between our check and the insert (e.g. a parallel sign-up).
        if (!fields.some((f) => f.includes('username'))) {
          return { error: 'account_exists' };
        }
      }
    }
    throw new ConflictException('Could not generate a unique username');
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    username: string;
    userType: UserType;
  }): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      userType: user.userType,
    };

    const accessToken = this.jwtService.sign(payload);

    // jti makes every refresh token unique, even for two logins in the same second
    // (same payload and same `iat` would otherwise produce the same JWT).
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
      jwtid: randomUUID(),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Housekeeping on every sign-in/refresh: drop this user's expired sessions.
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

}
