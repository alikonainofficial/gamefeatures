import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamesService } from '../games/games.service';
import { VotesService } from './votes.service';
import { RequestRankingService } from './ranking/request-ranking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestSort } from './dto/list-requests-query.dto';
import { RequestStatus, UserType } from '@game-review/database';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RequestRankingService,
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

    await this.ranking.upsert(request);

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
    sort: RequestSort = 'hot',
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
    const { ids, total } = await this.ranking.page(game.id, sort, skip, limit);

    const rows =
      ids.length > 0
        ? await this.prisma.featureRequest.findMany({
            where: { id: { in: ids } },
            include: {
              author: {
                select: { id: true, username: true, avatarUrl: true },
              },
              game: true,
              _count: {
                select: { comments: true },
              },
            },
          })
        : [];

    // Keep the ranking order (findMany doesn't preserve the order of `in`).
    const position = new Map(ids.map((id, index) => [id, index]));
    const requests = rows.sort((a, b) => position.get(a.id)! - position.get(b.id)!);

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
}
