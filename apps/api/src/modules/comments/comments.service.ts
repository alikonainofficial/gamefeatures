import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { MAX_COMMENT_DEPTH } from '@game-review/shared';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(requestId: string, dto: CreateCommentDto, authorId: string) {
    // Verify request exists
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
      include: { author: true },
    });

    if (!request) {
      throw new NotFoundException('Feature request not found');
    }

    // If replying to a comment, check depth
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent || parent.requestId !== requestId) {
        throw new NotFoundException('Parent comment not found');
      }

      // Check depth (count ancestors)
      const depth = await this.getCommentDepth(dto.parentId);
      if (depth >= MAX_COMMENT_DEPTH) {
        throw new ForbiddenException('Maximum comment depth reached');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        requestId,
        authorId,
        parentId: dto.parentId,
        content: dto.content,
      },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    // Notify request author if different from commenter
    if (request.authorId !== authorId) {
      await this.notificationsService.createCommentNotification(
        request.authorId,
        requestId,
        request.title,
        comment.author.username,
      );
    }

    return {
      ...comment,
      hasLiked: false,
      replies: [],
    };
  }

  async findByRequest(requestId: string, userId?: string) {
    // Verify request exists
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Feature request not found');
    }

    // Get all comments for this request
    const comments = await this.prisma.comment.findMany({
      where: { requestId },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get user's likes
    let likedSet = new Set<string>();
    if (userId && comments.length > 0) {
      const likes = await this.prisma.commentLike.findMany({
        where: {
          userId,
          commentId: { in: comments.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      likedSet = new Set(likes.map((l) => l.commentId));
    }

    // Build threaded structure
    const commentsWithLikes = comments.map((c) => ({
      ...c,
      hasLiked: likedSet.has(c.id),
      replies: [] as any[],
    }));

    const commentMap = new Map(commentsWithLikes.map((c) => [c.id, c]));
    const rootComments: typeof commentsWithLikes = [];

    for (const comment of commentsWithLikes) {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    }

    return rootComments;
  }

  async toggleLike(commentId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existingLike = await this.prisma.commentLike.findUnique({
      where: {
        commentId_userId: { commentId, userId },
      },
    });

    if (existingLike) {
      // Remove like
      await this.prisma.$transaction([
        this.prisma.commentLike.delete({
          where: { id: existingLike.id },
        }),
        this.prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);

      const updated = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { likeCount: true },
      });

      return { liked: false, likeCount: updated!.likeCount };
    } else {
      // Add like
      await this.prisma.$transaction([
        this.prisma.commentLike.create({
          data: { commentId, userId },
        }),
        this.prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      const updated = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { likeCount: true },
      });

      return { liked: true, likeCount: updated!.likeCount };
    }
  }

  private async getCommentDepth(commentId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = commentId;

    while (currentId) {
      const foundComment: { parentId: string | null } | null =
        await this.prisma.comment.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });

      if (!foundComment || !foundComment.parentId) {
        break;
      }

      depth++;
      currentId = foundComment.parentId;
    }

    return depth;
  }
}
