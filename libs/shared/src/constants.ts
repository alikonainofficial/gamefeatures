// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Vote milestones for notifications
export const VOTE_MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000] as const;

// Token expiration
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';

// Redis keys
export const REDIS_KEYS = {
  gameRequestsTop: (gameId: string) => `game:${gameId}:requests:top`,
  gameRequestsNew: (gameId: string) => `game:${gameId}:requests:new`,
  gameRequestsHot: (gameId: string) => `game:${gameId}:requests:hot`,
  /** Present when the three sorted sets above hold every request of the game. */
  gameRequestsIndexed: (gameId: string) => `game:${gameId}:requests:indexed`,
  userVotes: (userId: string) => `user:${userId}:votes`,
  userSession: (userId: string) => `user:${userId}:session`,
} as const;

// BullMQ queue names
export const QUEUE_NAMES = {
  notifications: 'notifications',
  gameImport: 'game-import',
} as const;

// WebSocket events
export const WS_EVENTS = {
  notification: 'notification',
  voteUpdate: 'vote_update',
  subscribe: 'subscribe',
  unsubscribe: 'unsubscribe',
} as const;

// API paths
export const API_PREFIX = '/api/v1';

// Comment constraints
export const MAX_COMMENT_LENGTH = 5000;
export const MAX_COMMENT_DEPTH = 5;

// Request constraints
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 10000;
