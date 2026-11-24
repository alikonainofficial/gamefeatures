import { Prisma } from '@game-review/database';

/**
 * The only user fields anyone may see. Use this (never a bare `include: { user: true }` or a
 * spread of the user row) for anything returned about another user.
 */
export const publicUserSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  userType: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** What a signed-in user sees about themselves: public fields plus email and admin flag. */
export const selfUserSelect = {
  ...publicUserSelect,
  email: true,
  isAdmin: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type SelfUser = Prisma.UserGetPayload<{ select: typeof selfUserSelect }>;
