import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { GamesService } from '../games/games.service';
import { VotesService } from './votes.service';
import { hotScore } from './ranking/hot-score';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestSort } from './dto/list-requests-query.dto';
import { RequestStatus, UserType } from '@game-review/database';
import { REDIS_KEYS } from '@game-review/shared';

type SortOption = RequestSort;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly gamesService: GamesService,
    private readonly votesService: VotesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateRequestDto, authorId: string) {
    // Verify game exists
    const game = await this.gamesService.findById(dto.gameId);

    const request = await this.prisma.featureRequest.create({
      data: {
        gameId: dto.gameId,
        authorId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
      },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true },
        },
        game: true,
      },
    });

    // Update Redis caches
    await this.addToRedisCache(request.id, game.id, 0, request.createdAt);

    // Notify followers of the author
    await this.notificationsService.notifyFollowersOfNewRequest(
      authorId,
      request.id,
      request.title,
      game.name,
    );

    return {
      ...request,
      hasVoted: false,
      commentsCount: 0,
    };
  }

  async findById(id: string, userId?: string) {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true },
        },
        game: true,
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Feature request not found');
    }

    let hasVoted = false;
    if (userId) {
      hasVoted = await this.votesService.hasUserVoted(id, userId);
    }

    return {
      ...request,
      hasVoted,
      commentsCount: request._count.comments,
      _count: undefined,
    };
  }

  async findByGame(
    gameSlug: string,
    sort: SortOption = 'hot',
    page = 1,
    limit = 20,
    userId?: string,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { slug: gameSlug },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const skip = (page - 1) * limit;

    // Try to get from Redis cache first
    const cachedIds = await this.getFromRedisCache(game.id, sort, skip, limit);

    let requests;
    let total;

    if (cachedIds && cachedIds.length > 0) {
      // Fetch requests by IDs
      requests = await this.prisma.featureRequest.findMany({
        where: { id: { in: cachedIds } },
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true },
          },
          game: true,
          _count: {
            select: { comments: true },
          },
        },
      });

      // Sort by cached order
      const idOrder = new Map(cachedIds.map((id, index) => [id, index]));
      requests.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

      total = await this.redis.zcard(this.getRedisKey(game.id, sort));
    } else {
      // Fallback to database
      const orderBy = this.getOrderBy(sort);
      [requests, total] = await Promise.all([
        this.prisma.featureRequest.findMany({
          where: { gameId: game.id },
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true },
            },
            game: true,
            _count: {
              select: { comments: true },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.featureRequest.count({
          where: { gameId: game.id },
        }),
      ]);
    }

    // Get user votes
    let votedSet = new Set<string>();
    if (userId && requests.length > 0) {
      votedSet = await this.votesService.getUserVotedRequests(
        requests.map((r) => r.id),
        userId,
      );
    }

    return {
      data: requests.map((r) => ({
        ...r,
        hasVoted: votedSet.has(r.id),
        commentsCount: r._count.comments,
        _count: undefined,
      })),
      meta: {
        total: total || 0,
        page,
        limit,
        totalPages: Math.ceil((total || 0) / limit),
      },
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateRequestStatusDto,
    userId: string,
    userType: UserType,
    isAdmin: boolean,
  ) {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id },
      include: { game: true },
    });

    if (!request) {
      throw new NotFoundException('Feature request not found');
    }

    // Check if user has permission (admin or game dev)
    const canUpdate =
      isAdmin ||
      (userType === UserType.DEVELOPER && request.game.devUserId === userId);

    if (!canUpdate) {
      throw new ForbiddenException('Only game developers can update request status');
    }

    const oldStatus = request.status;

    const updated = await this.prisma.featureRequest.update({
      where: { id },
      data: {
        status: dto.status,
        devResponse: dto.devResponse,
        devRespondedAt: dto.devResponse ? new Date() : undefined,
      },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true },
        },
        game: true,
      },
    });

    // Notify request author of status change
    if (oldStatus !== dto.status) {
      await this.notificationsService.createStatusChangeNotification(
        request.authorId,
        request.id,
        request.title,
        dto.status,
      );

      // Notify game followers if status is IN_PROGRESS or IMPLEMENTED
      if (dto.status === RequestStatus.IN_PROGRESS || dto.status === RequestStatus.IMPLEMENTED) {
        await this.notificationsService.notifyGameFollowers(
          request.gameId,
          request.id,
          request.title,
          dto.status,
        );
      }
    }

    return updated;
  }

  private async addToRedisCache(
    requestId: string,
    gameId: string,
    voteCount: number,
    createdAt: Date,
  ) {
    await Promise.all([
      this.redis.zadd(REDIS_KEYS.gameRequestsTop(gameId), voteCount, requestId),
      this.redis.zadd(REDIS_KEYS.gameRequestsNew(gameId), createdAt.getTime(), requestId),
      this.redis.zadd(
        REDIS_KEYS.gameRequestsHot(gameId),
        hotScore(voteCount, createdAt),
        requestId,
      ),
    ]);
  }

  private async getFromRedisCache(
    gameId: string,
    sort: SortOption,
    start: number,
    count: number,
  ): Promise<string[] | null> {
    const key = this.getRedisKey(gameId, sort);
    const isDescending = sort !== 'new'; // new is ascending (oldest first)

    try {
      if (isDescending) {
        return await this.redis.zrevrange(key, start, start + count - 1);
      } else {
        return await this.redis.zrange(key, start, start + count - 1);
      }
    } catch {
      return null;
    }
  }

  private getRedisKey(gameId: string, sort: SortOption): string {
    switch (sort) {
      case 'top':
        return REDIS_KEYS.gameRequestsTop(gameId);
      case 'new':
        return REDIS_KEYS.gameRequestsNew(gameId);
      case 'hot':
      default:
        return REDIS_KEYS.gameRequestsHot(gameId);
    }
  }

  private getOrderBy(sort: SortOption) {
    switch (sort) {
      case 'top':
        return { voteCount: 'desc' as const };
      case 'new':
        return { createdAt: 'desc' as const };
      case 'hot':
      default:
        return [{ voteCount: 'desc' as const }, { createdAt: 'desc' as const }];
    }
  }
}
