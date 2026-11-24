import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowType, Prisma } from '@game-review/database';
import { isPrismaError } from '../../common/prisma/is-prisma-error';

export interface FollowResult {
  following: boolean;
}

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: following someone you already follow is a no-op. */
  async followUser(followerId: string, followingId: string): Promise<FollowResult> {
    this.assertNotSelf(followerId, followingId);
    // A missing user fails the foreign key (P2003), which the Prisma filter maps to 404.
    await this.createIgnoringDuplicate({ followerId, followingId, followType: FollowType.USER });
    return { following: true };
  }

  /** Idempotent: unfollowing someone you don't follow is a no-op. */
  async unfollowUser(followerId: string, followingId: string): Promise<FollowResult> {
    this.assertNotSelf(followerId, followingId);
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId, followType: FollowType.USER },
    });
    if (count === 0 && !(await this.prisma.user.findUnique({ where: { id: followingId } }))) {
      throw new NotFoundException('User not found');
    }
    return { following: false };
  }

  /** Idempotent: following a game you already follow is a no-op. */
  async followGame(followerId: string, gameId: string): Promise<FollowResult> {
    await this.createIgnoringDuplicate({ followerId, gameId, followType: FollowType.GAME });
    return { following: true };
  }

  /** Idempotent: unfollowing a game you don't follow is a no-op. */
  async unfollowGame(followerId: string, gameId: string): Promise<FollowResult> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, gameId, followType: FollowType.GAME },
    });
    if (count === 0 && !(await this.prisma.game.findUnique({ where: { id: gameId } }))) {
      throw new NotFoundException('Game not found');
    }
    return { following: false };
  }

  private assertNotSelf(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }
  }

  private async createIgnoringDuplicate(data: Prisma.FollowUncheckedCreateInput) {
    try {
      await this.prisma.follow.create({ data });
    } catch (error) {
      if (!isPrismaError(error, 'P2002')) throw error;
    }
  }

  async getUserFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followingId: userId,
          followType: FollowType.USER,
        },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({
        where: {
          followingId: userId,
          followType: FollowType.USER,
        },
      }),
    ]);

    return {
      data: followers.map((f) => f.follower),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followerId: userId,
          followType: FollowType.USER,
        },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({
        where: {
          followerId: userId,
          followType: FollowType.USER,
        },
      }),
    ]);

    return {
      data: following.map((f) => f.following),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserFollowedGames(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followerId: userId,
          followType: FollowType.GAME,
        },
        include: {
          game: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({
        where: {
          followerId: userId,
          followType: FollowType.GAME,
        },
      }),
    ]);

    return {
      data: follows.map((f) => f.game),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isFollowingUser(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        followingId,
        followType: FollowType.USER,
      },
    });
    return !!follow;
  }

  async isFollowingGame(followerId: string, gameId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        gameId,
        followType: FollowType.GAME,
      },
    });
    return !!follow;
  }
}
