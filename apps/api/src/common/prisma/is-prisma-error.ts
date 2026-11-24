import { Prisma } from '@game-review/database';

/** True when `error` is a Prisma known-request error with the given code (e.g. 'P2002'). */
export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
