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
import { UserType } from '@game-review/database';
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

  async validateOAuthUser(profile: {
    email: string;
    username: string;
    avatarUrl?: string;
    googleId?: string;
    twitchId?: string;
  }): Promise<AuthTokens> {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          profile.googleId ? { googleId: profile.googleId } : {},
          profile.twitchId ? { twitchId: profile.twitchId } : {},
        ].filter((obj) => Object.keys(obj).length > 0),
      },
    });

    if (user) {
      // Update OAuth IDs if not set
      const updates: any = {};
      if (profile.googleId && !user.googleId) {
        updates.googleId = profile.googleId;
      }
      if (profile.twitchId && !user.twitchId) {
        updates.twitchId = profile.twitchId;
      }
      if (profile.avatarUrl && !user.avatarUrl) {
        updates.avatarUrl = profile.avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    } else {
      // Generate unique username
      let username = profile.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existingUsername = await this.prisma.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        username = `${username}${randomBytes(3).toString('hex')}`;
      }

      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          username,
          avatarUrl: profile.avatarUrl,
          googleId: profile.googleId,
          twitchId: profile.twitchId,
          userType: UserType.GAMER,
        },
      });
    }

    return this.generateTokens(user);
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
