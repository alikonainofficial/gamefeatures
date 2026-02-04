import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { FcmService } from './fcm.service';
import { NotificationType, EntityType } from '@game-review/database';
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

@Processor(QUEUE_NAMES.notifications)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly fcmService: FcmService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>) {
    const { userId, type, entityType, entityId, title, message, actionUrl } = job.data;

    // 1. Persist notification to database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        entityType,
        entityId,
        title,
        message,
        actionUrl,
      },
    });

    // 2. Send real-time notification via WebSocket
    const sent = this.gateway.sendToUser(userId, {
      type: 'notification',
      payload: notification,
    });

    // 3. If user is not connected via WebSocket, send push notification
    if (!sent) {
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: { userId },
        select: { token: true },
      });

      if (deviceTokens.length > 0) {
        await this.fcmService.sendToTokens(
          deviceTokens.map((t) => t.token),
          {
            title,
            body: message,
            data: {
              type,
              entityType,
              entityId,
              actionUrl: actionUrl || '',
            },
          },
        );

        // Mark as pushed
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { isPushed: true },
        });
      }
    }

    return notification;
  }
}
