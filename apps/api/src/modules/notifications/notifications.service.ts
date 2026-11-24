import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, EntityType, RequestStatus, FollowType } from '@game-review/database';
import { QUEUE_NAMES } from '@game-review/shared';

interface NotificationJobData {
  userId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  title: string;
  message: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.notifications) private readonly notificationQueue: Queue,
  ) {}

  async getUserNotifications(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit;
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async registerDeviceToken(userId: string, token: string) {
    // Upsert device token
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId },
      create: { userId, token },
    });
  }

  async removeDeviceToken(token: string) {
    return this.prisma.deviceToken.deleteMany({
      where: { token },
    });
  }

  // Notification creation methods

  async createVoteMilestoneNotification(
    userId: string,
    requestId: string,
    requestTitle: string,
    milestone: number,
  ) {
    await this.queueNotification({
      userId,
      type: NotificationType.VOTE_MILESTONE,
      entityType: EntityType.REQUEST,
      entityId: requestId,
      title: 'Vote Milestone Reached! 🎉',
      message: `Your request "${requestTitle}" has reached ${milestone} votes!`,
      actionUrl: `/requests/${requestId}`,
    });
  }

  async createStatusChangeNotification(
    userId: string,
    requestId: string,
    requestTitle: string,
    newStatus: RequestStatus,
  ) {
    const statusMessages: Record<RequestStatus, string> = {
      [RequestStatus.OPEN]: 'is now open',
      [RequestStatus.UNDER_REVIEW]: 'is under review by the dev team',
      [RequestStatus.IN_PROGRESS]: 'is now being worked on!',
      [RequestStatus.IMPLEMENTED]: 'has been implemented! 🎉',
      [RequestStatus.DECLINED]: 'has been declined',
    };

    await this.queueNotification({
      userId,
      type: NotificationType.REQUEST_STATUS_CHANGE,
      entityType: EntityType.REQUEST,
      entityId: requestId,
      title: 'Request Status Update',
      message: `Your request "${requestTitle}" ${statusMessages[newStatus]}`,
      actionUrl: `/requests/${requestId}`,
    });
  }

  async createCommentNotification(
    userId: string,
    requestId: string,
    requestTitle: string,
    commenterUsername: string,
  ) {
    await this.queueNotification({
      userId,
      type: NotificationType.COMMENT_ON_REQUEST,
      entityType: EntityType.REQUEST,
      entityId: requestId,
      title: 'New Comment',
      message: `${commenterUsername} commented on your request "${requestTitle}"`,
      actionUrl: `/requests/${requestId}`,
    });
  }

  async notifyFollowersOfNewRequest(
    authorId: string,
    requestId: string,
    requestTitle: string,
    gameName: string,
  ) {
    // Get all followers of the author
    const followers = await this.prisma.follow.findMany({
      where: {
        followingId: authorId,
        followType: FollowType.USER,
      },
      select: { followerId: true },
    });

    // Get author username
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { username: true },
    });

    // Queue notification for each follower
    for (const follower of followers) {
      await this.queueNotification({
        userId: follower.followerId,
        type: NotificationType.FOLLOWED_USER_POST,
        entityType: EntityType.REQUEST,
        entityId: requestId,
        title: 'New Feature Request',
        message: `${author?.username} posted "${requestTitle}" for ${gameName}`,
        actionUrl: `/requests/${requestId}`,
      });
    }
  }

  async notifyGameFollowers(
    gameId: string,
    requestId: string,
    requestTitle: string,
    newStatus: RequestStatus,
  ) {
    // Get all followers of the game
    const followers = await this.prisma.follow.findMany({
      where: {
        gameId,
        followType: FollowType.GAME,
      },
      select: { followerId: true },
    });

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { name: true },
    });

    const statusText = newStatus === RequestStatus.IN_PROGRESS ? 'started working on' : 'implemented';

    for (const follower of followers) {
      await this.queueNotification({
        userId: follower.followerId,
        type: NotificationType.FOLLOWED_GAME_UPDATE,
        entityType: EntityType.REQUEST,
        entityId: requestId,
        title: 'Game Update',
        message: `${game?.name} dev team ${statusText} "${requestTitle}"`,
        actionUrl: `/requests/${requestId}`,
      });
    }
  }

  private async queueNotification(data: NotificationJobData) {
    await this.notificationQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
}
