import {
  UserType,
  RequestType,
  RequestStatus,
  FollowType,
  NotificationType,
  EntityType,
} from './enums';

// User types
export interface UserBase {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  userType: UserType;
  createdAt: Date;
}

export interface UserProfile extends UserBase {
  followersCount: number;
  followingCount: number;
  requestsCount: number;
}

// Game types
export interface GameBase {
  id: string;
  externalId: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  description: string | null;
  releaseDate: Date | null;
  platforms: string[];
  genres: string[];
  isVerified: boolean;
}

export interface GameDetails extends GameBase {
  requestsCount: number;
  followersCount: number;
  devUser: UserBase | null;
}

// Feature Request types
export interface FeatureRequestBase {
  id: string;
  gameId: string;
  authorId: string;
  type: RequestType;
  title: string;
  description: string;
  voteCount: number;
  status: RequestStatus;
  devResponse: string | null;
  devRespondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureRequestDetails extends FeatureRequestBase {
  author: UserBase;
  game: GameBase;
  hasVoted: boolean;
  commentsCount: number;
}

// Vote types
export interface Vote {
  id: string;
  userId: string;
  requestId: string;
  createdAt: Date;
}

// Comment types
export interface CommentBase {
  id: string;
  requestId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentDetails extends CommentBase {
  author: UserBase;
  hasLiked: boolean;
  replies?: CommentDetails[];
}

// Follow types
export interface Follow {
  id: string;
  followerId: string;
  followType: FollowType;
  followingId: string | null;
  gameId: string | null;
  createdAt: Date;
}

// Notification types
export interface NotificationBase {
  id: string;
  userId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  isPushed: boolean;
  createdAt: Date;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  userType: UserType;
  iat?: number;
  exp?: number;
}

// RAWG API types
export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  description_raw?: string;
  released: string | null;
  platforms: Array<{ platform: { id: number; name: string; slug: string } }>;
  genres: Array<{ id: number; name: string; slug: string }>;
}

export interface RawgSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawgGame[];
}

// WebSocket event types
export interface WsNotificationEvent {
  type: 'notification';
  payload: NotificationBase;
}

export interface WsVoteUpdateEvent {
  type: 'vote_update';
  payload: {
    requestId: string;
    voteCount: number;
  };
}

export type WsEvent = WsNotificationEvent | WsVoteUpdateEvent;
