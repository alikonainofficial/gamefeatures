import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isPrismaError } from '../../common/prisma/is-prisma-error';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { MAX_COMMENT_DEPTH } from '@game-review/shared';

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

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

  /** Idempotent: liking again is a no-op that returns the current count. */
  async addLike(commentId: string, userId: string): Promise<LikeResult> {
    try {
      const { likeCount } = await this.prisma.$transaction(async (tx) => {
        await tx.commentLike.create({ data: { commentId, userId } });
        return tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });
      });
      return { liked: true, likeCount };
    } catch (error) {
      // Duplicate like: already liked. A missing comment (P2003) becomes 404 via the filter.
      if (!isPrismaError(error, 'P2002')) throw error;
      return { liked: true, likeCount: await this.currentLikeCount(commentId) };
    }
  }

  /** Idempotent: unliking a comment you don't like returns the current count. */
  async removeLike(commentId: string, userId: string): Promise<LikeResult> {
    const comment = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.commentLike.deleteMany({ where: { commentId, userId } });
      return count === 1
        ? tx.comment.update({
            where: { id: commentId },
            data: { likeCount: { decrement: 1 } },
            select: { likeCount: true },
          })
        : tx.comment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return { liked: false, likeCount: comment.likeCount };
  }

  private async currentLikeCount(commentId: string): Promise<number> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { likeCount: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment.likeCount;
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
