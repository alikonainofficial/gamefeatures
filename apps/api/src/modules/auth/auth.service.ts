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
import { randomBytes } from 'crypto';

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
    try {
      // Verify refresh token
      this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Find refresh token in database
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedException('Refresh token expired');
      }

      // Delete old refresh token (rotation)
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

      // Generate new tokens
      return this.generateTokens(storedToken.user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
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

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

}
