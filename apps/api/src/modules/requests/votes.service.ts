import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { NotificationsService } from '../notifications/notifications.service';
import { VOTE_MILESTONES, REDIS_KEYS } from '@game-review/shared';
import { hotScore } from './ranking/hot-score';

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly notificationsService: NotificationsService,
  ) {}

  async toggleVote(requestId: string, userId: string): Promise<{ voted: boolean; voteCount: number }> {
    const existingVote = await this.prisma.vote.findUnique({
      where: {
        userId_requestId: { userId, requestId },
      },
    });

    if (existingVote) {
      // Remove vote
      await this.prisma.$transaction([
        this.prisma.vote.delete({
          where: { id: existingVote.id },
        }),
        this.prisma.featureRequest.update({
          where: { id: requestId },
          data: { voteCount: { decrement: 1 } },
        }),
      ]);

      const request = await this.prisma.featureRequest.findUnique({
        where: { id: requestId },
        select: { voteCount: true, gameId: true },
      });

      // Update Redis cache
      await this.updateRedisCache(requestId, request!.gameId, request!.voteCount);

      return { voted: false, voteCount: request!.voteCount };
    } else {
      // Add vote
      const [, request] = await this.prisma.$transaction([
        this.prisma.vote.create({
          data: { userId, requestId },
        }),
        this.prisma.featureRequest.update({
          where: { id: requestId },
          data: { voteCount: { increment: 1 } },
          include: {
            author: true,
            game: true,
          },
        }),
      ]);

      // Update Redis cache
      await this.updateRedisCache(requestId, request.gameId, request.voteCount);

      // Check for milestone notifications
      await this.checkVoteMilestone(request, request.voteCount);

      return { voted: true, voteCount: request.voteCount };
    }
  }

  async hasUserVoted(requestId: string, userId: string): Promise<boolean> {
    const vote = await this.prisma.vote.findUnique({
      where: {
        userId_requestId: { userId, requestId },
      },
    });
    return !!vote;
  }

  async getUserVotedRequests(requestIds: string[], userId: string): Promise<Set<string>> {
    const votes = await this.prisma.vote.findMany({
      where: {
        userId,
        requestId: { in: requestIds },
      },
      select: { requestId: true },
    });
    return new Set(votes.map((v) => v.requestId));
  }

  private async updateRedisCache(requestId: string, gameId: string, voteCount: number) {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
      select: { createdAt: true },
    });

    if (!request) return;

    // Update top sorted set
    await this.redis.zadd(REDIS_KEYS.gameRequestsTop(gameId), voteCount, requestId);

    // Update new sorted set (score is timestamp)
    await this.redis.zadd(
      REDIS_KEYS.gameRequestsNew(gameId),
      request.createdAt.getTime(),
      requestId,
    );

    // Update hot sorted set
    await this.redis.zadd(
      REDIS_KEYS.gameRequestsHot(gameId),
      hotScore(voteCount, request.createdAt),
      requestId,
    );
  }

  private async checkVoteMilestone(
    request: { id: string; authorId: string; title: string; voteCount: number },
    newVoteCount: number,
  ) {
    for (const milestone of VOTE_MILESTONES) {
      if (newVoteCount === milestone) {
        await this.notificationsService.createVoteMilestoneNotification(
          request.authorId,
          request.id,
          request.title,
          milestone,
        );
        break;
      }
    }
  }
}
