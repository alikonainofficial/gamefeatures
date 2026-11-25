import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');

    if (projectId && privateKey && clientEmail) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
        });
        this.initialized = true;
        this.logger.log('Firebase Admin initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Firebase Admin', (error as Error)?.stack);
      }
    } else {
      this.logger.log('Firebase credentials not configured, push notifications disabled');
    }
  }

  async sendToTokens(tokens: string[], message: PushMessage): Promise<void> {
    if (!this.initialized || tokens.length === 0) {
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
        webpush: {
          fcmOptions: {
            link: message.data?.actionUrl || '/',
          },
        },
      });

      this.logger.log(`Push sent: ${response.successCount} success, ${response.failureCount} failed`);

      // TODO: Handle failed tokens (remove invalid ones from database)
    } catch (error) {
      this.logger.error('Failed to send push notification', (error as Error)?.stack);
    }
  }

  async sendToTopic(topic: string, message: PushMessage): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await admin.messaging().send({
        topic,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
      });
    } catch (error) {
      this.logger.error('Failed to send topic notification', (error as Error)?.stack);
    }
  }
}
