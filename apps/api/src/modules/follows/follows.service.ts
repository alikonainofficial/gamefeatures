import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowType } from '@game-review/database';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleFollowUser(
    followerId: string,
    followingId: string,
  ): Promise<{ following: boolean }> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingFollow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        followingId,
        followType: FollowType.USER,
      },
    });

    if (existingFollow) {
      await this.prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      return { following: false };
    } else {
      await this.prisma.follow.create({
        data: {
          followerId,
          followingId,
          followType: FollowType.USER,
        },
      });
      return { following: true };
    }
  }

  async toggleFollowGame(
    followerId: string,
    gameId: string,
  ): Promise<{ following: boolean }> {
    // Verify game exists
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const existingFollow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        gameId,
        followType: FollowType.GAME,
      },
    });

    if (existingFollow) {
      await this.prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      return { following: false };
    } else {
      await this.prisma.follow.create({
        data: {
          followerId,
          gameId,
          followType: FollowType.GAME,
        },
      });
      return { following: true };
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
