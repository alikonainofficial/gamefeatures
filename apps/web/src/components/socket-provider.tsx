'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@game-review/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';

/**
 * Sockets connect straight to the API server (Vercel's rewrites don't proxy WebSockets).
 * That's fine cross-origin: the socket authenticates with the access token, not a cookie.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  /** Joins a public room (e.g. `request:<id>`); re-joined automatically after reconnects. */
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  actionUrl?: string | null;
}

/**
 * Owns the one Socket.IO connection per tab. It connects when the user is signed in,
 * reconnects when the access token changes (the server checks the token on connect), and
 * keeps the unread badge in sync: an initial count from the API, then +1 per live event.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const rooms = useRef(new Set<string>());

  // Initial unread count on sign-in; reset on sign-out.
  useEffect(() => {
    const { setUnreadCount } = useNotificationStore.getState();
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    api
      .get<{ meta: { unreadCount: number } }>('/me/notifications?unread=true&limit=1')
      .then((res) => setUnreadCount(res.meta.unreadCount))
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const next = io(`${SOCKET_URL}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    next.on('connect', () => {
      setIsConnected(true);
      rooms.current.forEach((room) => next.emit(WS_EVENTS.subscribe, { room }));
    });
    next.on('disconnect', () => setIsConnected(false));
    next.on(WS_EVENTS.notification, (notification: NotificationPayload) => {
      const store = useNotificationStore.getState();
      store.incrementUnread();
      store.pushToast({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
      });
    });

    setSocket(next);
    return () => {
      next.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, accessToken]);

  const subscribe = useCallback(
    (room: string) => {
      rooms.current.add(room);
      socket?.emit(WS_EVENTS.subscribe, { room });
    },
    [socket],
  );

  const unsubscribe = useCallback(
    (room: string) => {
      rooms.current.delete(room);
      socket?.emit(WS_EVENTS.unsubscribe, { room });
    },
    [socket],
  );

  return (
    <SocketContext.Provider value={{ socket, isConnected, subscribe, unsubscribe }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const value = useContext(SocketContext);
  if (!value) throw new Error('useSocket must be used inside <SocketProvider>');
  return value;
}
