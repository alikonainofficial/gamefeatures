import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VOTE_MILESTONES } from '@game-review/shared';
import { RequestRankingService } from './ranking/request-ranking.service';

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RequestRankingService,
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
        select: { id: true, voteCount: true, gameId: true, createdAt: true },
      });

      await this.ranking.upsert(request!);

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

      await this.ranking.upsert(request);

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
