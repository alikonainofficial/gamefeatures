import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@game-review/database';
import { PrismaService } from '../../prisma/prisma.service';
import { isPrismaError } from '../../common/prisma/is-prisma-error';
import { NotificationsService } from '../notifications/notifications.service';
import { VOTE_MILESTONES } from '@game-review/shared';
import { RequestRankingService } from './ranking/request-ranking.service';

export interface VoteResult {
  voted: boolean;
  voteCount: number;
}

const VOTED_REQUEST_SELECT = {
  id: true,
  gameId: true,
  authorId: true,
  title: true,
  voteCount: true,
  createdAt: true,
} satisfies Prisma.FeatureRequestSelect;

type VotedRequest = Prisma.FeatureRequestGetPayload<{ select: typeof VOTED_REQUEST_SELECT }>;

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RequestRankingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Idempotent: voting again is a no-op that returns the current count. */
  async addVote(requestId: string, userId: string): Promise<VoteResult> {
    let request: VotedRequest;
    let created = false;

    try {
      request = await this.prisma.$transaction(async (tx) => {
        await tx.vote.create({ data: { userId, requestId } });
        return tx.featureRequest.update({
          where: { id: requestId },
          data: { voteCount: { increment: 1 } },
          select: VOTED_REQUEST_SELECT,
        });
      });
      created = true;
    } catch (error) {
      // A failed statement aborts the Postgres transaction, so the duplicate is caught out
      // here. A missing request (P2003) propagates and the Prisma filter turns it into 404.
      if (!isPrismaError(error, 'P2002')) throw error;
      request = await this.findVotedRequest(requestId);
    }

    await this.ranking.upsert(request);
    if (created) {
      await this.checkVoteMilestone(request, request.voteCount);
    }
    return { voted: true, voteCount: request.voteCount };
  }

  /** Idempotent: removing a vote that isn't there returns the current count. */
  async removeVote(requestId: string, userId: string): Promise<VoteResult> {
    const request = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.vote.deleteMany({ where: { userId, requestId } });
      return count === 1
        ? tx.featureRequest.update({
            where: { id: requestId },
            data: { voteCount: { decrement: 1 } },
            select: VOTED_REQUEST_SELECT,
          })
        : tx.featureRequest.findUnique({ where: { id: requestId }, select: VOTED_REQUEST_SELECT });
    });

    if (!request) {
      throw new NotFoundException('Feature request not found');
    }

    await this.ranking.upsert(request);
    return { voted: false, voteCount: request.voteCount };
  }

  private async findVotedRequest(requestId: string): Promise<VotedRequest> {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
      select: VOTED_REQUEST_SELECT,
    });
    if (!request) {
      throw new NotFoundException('Feature request not found');
    }
    return request;
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
