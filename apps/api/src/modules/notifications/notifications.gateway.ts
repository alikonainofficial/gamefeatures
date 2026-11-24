import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WS_EVENTS } from '@game-review/shared';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

/** `request:<cuid>`; Prisma cuids are 25 lowercase alphanumerics (allow some slack). */
const REQUEST_ROOM = /^request:[a-z0-9]{20,32}$/;

/** Returns the requested room if a client may join it, otherwise null. */
export function publicRoomFrom(data: unknown): string | null {
  const room = (data as { room?: unknown } | null | undefined)?.room;
  return typeof room === 'string' && REQUEST_ROOM.test(room) ? room : null;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>(); // userId -> socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const userId: string = payload.sub;
      client.userId = userId;

      // Track socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user-specific room
      client.join(`user:${userId}`);

      console.log(`Client connected: ${client.id} (user: ${client.userId})`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSocketIds = this.userSockets.get(client.userId);
      if (userSocketIds) {
        userSocketIds.delete(client.id);
        if (userSocketIds.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }
    console.log(`Client disconnected: ${client.id}`);
  }

  // Clients may only join public per-request rooms (live vote counts). The private
  // `user:<id>` room is joined by the server in handleConnection and nowhere else.
  @SubscribeMessage(WS_EVENTS.subscribe)
  handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    const room = publicRoomFrom(data);
    if (!room) return { error: 'Invalid room' };
    client.join(room);
    return { subscribed: room };
  }

  @SubscribeMessage(WS_EVENTS.unsubscribe)
  handleUnsubscribe(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    const room = publicRoomFrom(data);
    if (!room) return { error: 'Invalid room' };
    client.leave(room);
    return { unsubscribed: room };
  }

  // Send to specific user
  sendToUser(userId: string, event: { type: string; payload: any }): boolean {
    const hasConnections = this.userSockets.has(userId);
    if (hasConnections) {
      this.server.to(`user:${userId}`).emit(event.type, event.payload);
    }
    return hasConnections;
  }

  // Send vote update to a room (e.g., all users viewing a request)
  sendVoteUpdate(requestId: string, voteCount: number) {
    this.server.to(`request:${requestId}`).emit(WS_EVENTS.voteUpdate, {
      requestId,
      voteCount,
    });
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size ?? 0) > 0;
  }
}
