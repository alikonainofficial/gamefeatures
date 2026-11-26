import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { publicUserSelect, selfUserSelect } from './user.selects';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in user's own view (used by /auth/me). */
  async findSelf(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: selfUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get follower counts
    const [followersCount, followingCount, requestsCount] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: user.id, followType: 'USER' },
      }),
      this.prisma.follow.count({
        where: { followerId: user.id, followType: 'USER' },
      }),
      this.prisma.featureRequest.count({
        where: { authorId: user.id },
      }),
    ]);

    return {
      ...user,
      followersCount,
      followingCount,
      requestsCount,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: selfUserSelect,
    });
  }

  async getUserRequests(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      this.prisma.featureRequest.findMany({
        where: { authorId: userId },
        include: {
          game: true,
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.featureRequest.count({
        where: { authorId: userId },
      }),
    ]);

    return {
      data: requests.map((r) => ({
        ...r,
        commentsCount: r._count.comments,
        _count: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserFeed(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Get users that the current user follows
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId, followType: 'USER' },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId).filter(Boolean) as string[];

    if (followingIds.length === 0) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const [requests, total] = await Promise.all([
      this.prisma.featureRequest.findMany({
        where: { authorId: { in: followingIds } },
        include: {
          game: true,
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.featureRequest.count({
        where: { authorId: { in: followingIds } },
      }),
    ]);

    return {
      data: requests.map((r) => ({
        ...r,
        commentsCount: r._count.comments,
        _count: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
