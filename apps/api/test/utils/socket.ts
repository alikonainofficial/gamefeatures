import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway';
import { TestApp } from './create-test-app';
import { TestUser } from './factories';
import { waitFor } from './wait-for';

const sockets: Socket[] = [];

/** Opens a socket.io client to the test server's /notifications namespace. */
export function openSocket(t: TestApp, token?: string): Socket {
  const { port } = t.app.getHttpServer().address() as AddressInfo;
  const socket = io(`http://127.0.0.1:${port}/notifications`, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  sockets.push(socket);
  return socket;
}

/** Resolves once the server has accepted the connection and joined the user's private room. */
export async function connectedSocket(t: TestApp, user: TestUser): Promise<Socket> {
  const socket = openSocket(t, user.token);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  const gateway = t.app.get(NotificationsGateway);
  await waitFor(() => expect(gateway.isUserOnline(user.user.id)).toBe(true));
  return socket;
}

/** Gives in-flight socket events time to arrive before asserting that nothing did. */
export const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/** Collects every payload a socket receives for an event. */
export function collect<T = unknown>(socket: Socket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

export function closeAllSockets(): void {
  while (sockets.length > 0) sockets.pop()!.close();
}
